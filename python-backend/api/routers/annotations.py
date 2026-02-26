"""
Annotations: generate instruction pairs from knowledge points.
Supports sync generate and async generate-job for recoverable long-running tasks.
"""
import json as json_module
import re
import logging
import uuid
import threading
from typing import Dict, Any, List, Optional, Callable, Tuple

from fastapi import APIRouter, HTTPException, Body, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from api.helpers import resolve_api_key
from api.db import get_db, get_db_session
from database.models import Skill, Rule, SkillRule, AnnotationGenerationJob

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_skills_context(skill_ids: List[int], db: Session) -> str:
    if not skill_ids:
        return ""
    skills = db.query(Skill).filter(Skill.id.in_(skill_ids), Skill.enabled.is_(True)).all()
    if not skills:
        return ""
    lines = ["Available skills to consider when generating (use where relevant):"]
    for i, s in enumerate(skills, 1):
        name = (s.name or "").strip()
        desc = (s.description or "").strip()
        if name:
            lines.append(f"  {i}) {name}" + (f": {desc}" if desc else ""))
        trigger = (s.trigger_conditions or "").strip()
        if trigger:
            lines.append(f"     Trigger: {trigger}")
        steps = (s.steps or "").strip()
        if steps:
            lines.append(f"     Steps: {steps}")
        output_desc = (s.output_description or "").strip()
        if output_desc:
            lines.append(f"     Output: {output_desc}")
        example = (s.example or "").strip()
        if example:
            lines.append(f"     Example: {example}")
        rule_text = (s.rule or "").strip()
        if rule_text:
            lines.append(f"     Rule (inline): {rule_text}")
        linked_rule_ids = db.execute(select(SkillRule.rule_id).where(SkillRule.skill_id == s.id)).scalars().all()
        if linked_rule_ids:
            rules = db.query(Rule).filter(Rule.id.in_(linked_rule_ids), Rule.enabled.is_(True)).all()
            for r in rules:
                content = (r.content or "").strip()
                if content:
                    rname = (r.name or "").strip() or "Rule"
                    lines.append(f"     Rule [{rname}]: {content}")
    return "\n".join(lines) + "\n\n"


def _normalize_kp_to_str(kp: Any) -> str:
    if isinstance(kp, str):
        return kp
    if isinstance(kp, dict):
        return (kp.get("content") or kp.get("text") or "").strip() or json_module.dumps(kp)[:2000]
    return str(kp)[:2000]


def _run_generation(
    body: Dict[str, Any],
    db: Session,
    progress_callback: Optional[Callable[[float], None]] = None,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    from services.annotation_service import AnnotationService

    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        try:
            knowledge_points = json_module.loads(knowledge_points)
        except Exception:
            knowledge_points = []
    if not isinstance(knowledge_points, list):
        knowledge_points = []
    api_key = (body.get("api_key") or "").strip() or ""
    platform = (body.get("platform") or "").strip().lower()
    model = body.get("model", "deepseek-chat")
    base_url = body.get("base_url")
    candidate_count = body.get("candidate_count", 1)
    skill_ids = body.get("skill_ids")
    if skill_ids is not None and not isinstance(skill_ids, list):
        skill_ids = []
    if skill_ids is not None:
        skill_ids = [int(x) for x in skill_ids if isinstance(x, (int, float)) or (isinstance(x, str) and x.isdigit())]
    try:
        candidate_count = int(candidate_count)
    except Exception:
        candidate_count = 1
    candidate_count = max(1, min(10, candidate_count))
    if not api_key and platform:
        api_key = resolve_api_key(platform)
    skills_context = _build_skills_context(skill_ids or [], db)
    service = AnnotationService(api_key=api_key or None, model=model, base_url=base_url)
    annotations: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_pairs = set()
    total = max(1, len(knowledge_points))

    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    for i, kp in enumerate(knowledge_points):
        kp_str = _normalize_kp_to_str(kp)
        candidate_result = service.generate_instruction_candidates(
            kp_str, candidate_count, skills_context=skills_context
        )
        kp_annotations = candidate_result.get("annotations", [])
        kp_errors = candidate_result.get("errors", [])

        for ann in kp_annotations:
            instruction = (ann.get("instruction") or "").strip()
            response = (ann.get("response") or "").strip()
            if not instruction or not response:
                continue
            dedupe_key = f"{_normalize_text(instruction)}|||{_normalize_text(response)}"
            if dedupe_key in seen_pairs:
                continue
            seen_pairs.add(dedupe_key)
            annotations.append({"instruction": instruction, "response": response})
        for err_msg in kp_errors:
            if err_msg:
                errors.append(err_msg)
        if progress_callback is not None:
            progress_callback(100.0 * (i + 1) / total)

    return annotations, errors


def _run_generation_job(job_id: str, request_body: Dict[str, Any]) -> None:
    db = get_db_session()
    try:
        job = db.query(AnnotationGenerationJob).filter(AnnotationGenerationJob.job_id == job_id).first()
        if not job or job.status not in ("pending", "running"):
            return
        job.status = "running"
        job.progress = 0.0
        db.commit()

        def on_progress(progress: float) -> None:
            j = db.query(AnnotationGenerationJob).filter(AnnotationGenerationJob.job_id == job_id).first()
            if j and j.status == "running":
                j.progress = min(100.0, max(0.0, progress))
                db.commit()

        annotations, errors = _run_generation(request_body, db, progress_callback=on_progress)
        job = db.query(AnnotationGenerationJob).filter(AnnotationGenerationJob.job_id == job_id).first()
        if not job:
            return
        if errors and not annotations:
            first_err = errors[0] if errors else "Unknown error"
            if "402" in first_err or "Insufficient Balance" in first_err:
                job.error_message = "Insufficient Balance (402). Please top up your DeepSeek account."
            else:
                job.error_message = first_err[:500] if len(first_err) > 500 else first_err
            job.status = "failed"
        else:
            job.result_json = json_module.dumps(annotations, ensure_ascii=False)
            job.status = "completed"
            job.progress = 100.0
        db.commit()
    except Exception as e:
        logger.exception("annotation generation job %s failed", job_id)
        try:
            job = db.query(AnnotationGenerationJob).filter(AnnotationGenerationJob.job_id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)[:500]
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


@router.post("/annotations/generate")
async def generate_annotations(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Generate instruction pairs from knowledge points (sync). Optional skill_ids to inject skills context."""
    knowledge_points = body.get("knowledge_points", [])
    logger.info(
        "annotations/generate: request received, knowledge_points_count=%d",
        len(knowledge_points) if isinstance(knowledge_points, list) else 0,
    )
    annotations, errors = _run_generation(body, db, progress_callback=None)
    logger.info("annotations/generate: done, annotations_count=%d", len(annotations))
    result = {"annotations": annotations}
    if not annotations and errors:
        first_err = errors[0] if errors else ""
        if "402" in first_err or "Insufficient Balance" in first_err:
            result["error"] = "Insufficient Balance (402). Please top up your DeepSeek account."
        else:
            result["error"] = first_err[:200] if len(first_err) > 200 else first_err
    return result


@router.post("/annotations/generate-job")
async def submit_generation_job(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Start annotation generation as a background job. Returns job_id; poll GET /annotations/jobs/{job_id} for status and result."""
    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        try:
            knowledge_points = json_module.loads(knowledge_points)
        except Exception:
            knowledge_points = []
    if not isinstance(knowledge_points, list) or len(knowledge_points) == 0:
        raise HTTPException(status_code=400, detail="knowledge_points must be a non-empty list")
    job_id = str(uuid.uuid4())
    try:
        request_json = json_module.dumps(body, ensure_ascii=False)
    except Exception:
        request_json = "{}"
    job = AnnotationGenerationJob(
        job_id=job_id,
        status="pending",
        progress=0.0,
        request_json=request_json,
    )
    db.add(job)
    db.commit()
    thread = threading.Thread(target=_run_generation_job, args=(job_id, body))
    thread.daemon = True
    thread.start()
    return {"job_id": job_id}


@router.get("/annotations/jobs")
async def list_annotation_generation_jobs(limit: int = 50, db: Session = Depends(get_db)):
    """List recent annotation generation jobs (for recovery / show running)."""
    jobs = (
        db.query(AnnotationGenerationJob)
        .order_by(AnnotationGenerationJob.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return [
        {
            "job_id": j.job_id,
            "status": j.status,
            "progress": j.progress,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "error_message": j.error_message,
        }
        for j in jobs
    ]


@router.get("/annotations/jobs/{job_id}")
async def get_annotation_generation_job(job_id: str, db: Session = Depends(get_db)):
    """Get status and result of an annotation generation job. Result only when status is completed."""
    job = db.query(AnnotationGenerationJob).filter(AnnotationGenerationJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    out = {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "error_message": job.error_message,
    }
    if job.status == "completed" and job.result_json:
        try:
            out["annotations"] = json_module.loads(job.result_json)
        except Exception:
            out["annotations"] = []
    return out
