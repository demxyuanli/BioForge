"""
Finetuning: estimate, submit, jobs list, job logs, job status.
"""
import os
import logging
import tempfile
from datetime import datetime
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, Body, Depends
from sqlalchemy.orm import Session

from database.models import FinetuningJob, TrainingAnnotation, TrainingAnnotationFinetuningLink
from api.db import get_db
from api.helpers import resolve_api_key

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_annotation_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _normalize_progress_for_monitor(progress: Any) -> float:
    try:
        p = float(progress or 0.0)
    except Exception:
        p = 0.0
    if p > 1.0:
        p = p / 100.0
    if p < 0.0:
        p = 0.0
    if p > 1.0:
        p = 1.0
    return p


def _is_placeholder_finetuning_job(job: FinetuningJob) -> bool:
    jid = (job.job_id or "").strip()
    if not jid:
        return False
    return "_privatetune_job_" in jid


def _sync_placeholder_finetuning_job_state(db: Session, job: FinetuningJob, monitor_service: Any) -> bool:
    if not _is_placeholder_finetuning_job(job):
        return False
    if (job.status or "").lower() in ("completed", "failed", "cancelled"):
        return False

    now = datetime.utcnow()
    created_at = job.created_at or now
    elapsed = max(0.0, (now - created_at).total_seconds())
    warmup_seconds = 8.0
    complete_seconds = 180.0

    if elapsed < warmup_seconds:
        next_status = "submitted"
        next_progress = 0.0
    elif elapsed < complete_seconds:
        ratio = (elapsed - warmup_seconds) / max(1.0, (complete_seconds - warmup_seconds))
        next_status = "running"
        next_progress = max(1.0, min(95.0, ratio * 95.0))
    else:
        next_status = "completed"
        next_progress = 100.0

    cur_status = (job.status or "").lower()
    cur_progress = float(job.progress or 0.0)
    changed = (cur_status != next_status) or (abs(cur_progress - next_progress) >= 1.0)
    if not changed:
        return False

    job.status = next_status
    job.progress = round(next_progress, 2)
    if next_status == "completed":
        if not job.completed_at:
            job.completed_at = now
        if job.cost_usd is None:
            job.cost_usd = 0.0

    try:
        monitor_service.log_job_progress(
            job.job_id,
            _normalize_progress_for_monitor(job.progress),
            job.status,
            {"source": "placeholder_simulator"},
        )
    except Exception:
        pass
    return True


@router.post("/finetuning/estimate")
async def estimate_cost(request: Dict[str, Any]):
    """Estimate fine-tuning cost."""
    from services.finetuning_service import FineTuningService
    dataset_size = request.get("dataset_size", 0)
    model = request.get("model", "")
    platform = request.get("platform", "")
    service = FineTuningService()
    return service.estimate_cost(dataset_size, model, platform)


@router.post("/finetuning/submit")
async def submit_finetuning_job(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Submit fine-tuning job."""
    from services.finetuning_service import FineTuningService

    training_data = body.get("training_data", {})
    platform = (body.get("platform") or "").strip().lower()
    model = body.get("model", "")
    api_key = (body.get("api_key") or "").strip() or ""
    if not api_key and platform:
        api_key = resolve_api_key(platform)
    annotations = training_data.get("annotations", [])
    format_type = training_data.get("format_type", "sft")
    if not isinstance(annotations, list):
        annotations = []

    submitted_ids: List[int] = []
    for ann in annotations:
        if not isinstance(ann, dict):
            continue
        ann_id = ann.get("id")
        if ann_id is None:
            continue
        try:
            ann_id_int = int(ann_id)
        except Exception:
            continue
        if ann_id_int > 0:
            submitted_ids.append(ann_id_int)
    if submitted_ids:
        submitted_ids = list(dict.fromkeys(submitted_ids))

    tuned_ids: set = set()
    if submitted_ids:
        tuned_rows = db.query(TrainingAnnotationFinetuningLink.training_annotation_id).filter(
            TrainingAnnotationFinetuningLink.training_annotation_id.in_(submitted_ids)
        ).all()
        tuned_ids = {int(row[0]) for row in tuned_rows}

    tuned_pairs: set = set()
    tuned_pair_rows = (
        db.query(TrainingAnnotation.instruction, TrainingAnnotation.response)
        .join(
            TrainingAnnotationFinetuningLink,
            TrainingAnnotation.id == TrainingAnnotationFinetuningLink.training_annotation_id,
        )
        .all()
    )
    for instruction_text, response_text in tuned_pair_rows:
        tuned_pairs.add((
            _normalize_annotation_text(instruction_text),
            _normalize_annotation_text(response_text),
        ))

    filtered_annotations: List[Dict[str, Any]] = []
    filtered_annotation_ids: List[int] = []
    for ann in annotations:
        if not isinstance(ann, dict):
            continue
        instruction = ann.get("instruction", ann.get("question", ""))
        response = ann.get("response", ann.get("answer", ""))
        norm_pair = (
            _normalize_annotation_text(instruction),
            _normalize_annotation_text(response),
        )
        if not norm_pair[0] or not norm_pair[1]:
            continue
        ann_id = ann.get("id")
        ann_id_int = None
        if ann_id is not None:
            try:
                ann_id_int = int(ann_id)
            except Exception:
                ann_id_int = None
        if ann_id_int is not None and ann_id_int in tuned_ids:
            continue
        if norm_pair in tuned_pairs:
            continue
        filtered_annotations.append(ann)
        if ann_id_int is not None and ann_id_int > 0:
            filtered_annotation_ids.append(ann_id_int)

    if not filtered_annotations:
        raise HTTPException(status_code=400, detail="No untuned annotations available for submission")

    logger.info(
        "finetuning/submit: input platform=%s, model=%s, format_type=%s, annotations_count=%d, api_key_set=%s",
        platform, model, format_type, len(filtered_annotations), bool(api_key),
    )
    if filtered_annotations:
        first = filtered_annotations[0]
        instr = first.get("instruction", first.get("question", ""))[:80] if isinstance(first, dict) else ""
        logger.info("finetuning/submit: first_instruction_preview=%r", instr + ("..." if len(str(instr)) > 80 else ""))

    service = FineTuningService()
    formatted_data = service.prepare_training_data(filtered_annotations, format_type)
    logger.info("finetuning/submit: prepared_data_len=%d chars", len(formatted_data))

    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", delete=False, suffix=".jsonl") as tmp_file:
        tmp_file.write(formatted_data)
        tmp_path = tmp_file.name

    try:
        job_info = service.submit_finetuning_job(tmp_path, model, platform, api_key)
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass

    logger.info(
        "finetuning/submit: output job_id=%s, status=%s",
        job_info.get("job_id", ""), job_info.get("status", ""),
    )

    annotation_ids = list(dict.fromkeys([x for x in filtered_annotation_ids if x > 0]))
    try:
        job_db = FinetuningJob(
            job_id=job_info["job_id"],
            platform=platform,
            model=model,
            status=job_info["status"],
            progress=0.0,
        )
        db.add(job_db)
        db.flush()
        if annotation_ids:
            existing_rows = db.query(TrainingAnnotation.id).filter(
                TrainingAnnotation.id.in_(annotation_ids)
            ).all()
            existing_ids = {row[0] for row in existing_rows}
            for ann_id in annotation_ids:
                if ann_id not in existing_ids:
                    continue
                link = TrainingAnnotationFinetuningLink(
                    training_annotation_id=ann_id,
                    finetuning_job_id=job_info["job_id"],
                )
                db.add(link)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    out = dict(job_info)
    out["id"] = job_info.get("job_id", "")
    return out


@router.get("/finetuning/jobs")
async def list_finetuning_jobs(db: Session = Depends(get_db)):
    """List all fine-tuning jobs."""
    from services.monitoring_service import MonitoringService

    try:
        monitor = MonitoringService()
        jobs = db.query(FinetuningJob).all()
        changed = False
        for job in jobs:
            changed = _sync_placeholder_finetuning_job_state(db, job, monitor) or changed
        if changed:
            db.commit()
        return [
            {
                "id": job.job_id,
                "platform": job.platform,
                "model": job.model,
                "status": job.status,
                "progress": job.progress,
                "costUsd": job.cost_usd,
                "createdAt": job.created_at.isoformat() if job.created_at else None,
            }
            for job in jobs
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/finetuning/jobs/{job_id}/logs")
async def get_job_logs(job_id: str, limit: int = 100):
    """Get logs for a specific job."""
    from services.monitoring_service import MonitoringService
    service = MonitoringService()
    return service.get_job_logs(job_id, limit)


@router.get("/finetuning/jobs/{job_id}/status")
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Get detailed status for a job."""
    from services.monitoring_service import MonitoringService

    service = MonitoringService()
    job = db.query(FinetuningJob).filter(FinetuningJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    changed = _sync_placeholder_finetuning_job_state(db, job, service)
    if changed:
        db.commit()

    normalized_progress = _normalize_progress_for_monitor(job.progress)
    estimated_time = service.estimate_remaining_time(job_id, normalized_progress)
    cost_tracking = service.get_cost_tracking(job_id)
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "estimated_time_remaining": estimated_time,
        "cost_tracking": cost_tracking,
    }
