"""
Training items and training set (for Production Tuning).
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, HTTPException, Body, Query, Depends
from sqlalchemy.orm import Session

from database.models import TrainingItem, TrainingAnnotation, TrainingAnnotationFinetuningLink, FinetuningJob
from api.db import get_db
from api.shared import TRAINING_SET_PATH

router = APIRouter()
logger = logging.getLogger(__name__)


def _serialize_training_item(item: TrainingItem) -> Dict[str, Any]:
    knowledge_point_keys = []
    if item.knowledge_point_keys:
        try:
            parsed = json.loads(item.knowledge_point_keys)
            if isinstance(parsed, list):
                knowledge_point_keys = [str(v) for v in parsed if isinstance(v, str) and v.strip()]
        except Exception:
            knowledge_point_keys = []
    return {
        "id": item.id,
        "name": item.name or "",
        "knowledge_point_keys": knowledge_point_keys,
        "prompt_template": item.prompt_template or "",
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _collect_training_annotation_link_info(
    db, annotation_ids: List[int]
) -> Dict[int, List[Dict[str, Any]]]:
    if not annotation_ids:
        return {}
    rows = (
        db.query(TrainingAnnotationFinetuningLink, FinetuningJob)
        .outerjoin(FinetuningJob, TrainingAnnotationFinetuningLink.finetuning_job_id == FinetuningJob.job_id)
        .filter(TrainingAnnotationFinetuningLink.training_annotation_id.in_(annotation_ids))
        .order_by(
            TrainingAnnotationFinetuningLink.training_annotation_id.asc(),
            TrainingAnnotationFinetuningLink.used_at.desc(),
            TrainingAnnotationFinetuningLink.id.desc(),
        )
        .all()
    )
    by_annotation: Dict[int, List[Dict[str, Any]]] = {}
    for link, job in rows:
        by_annotation.setdefault(link.training_annotation_id, []).append({
            "job_id": link.finetuning_job_id,
            "used_at": link.used_at.isoformat() if link.used_at else None,
            "job_status": job.status if job else None,
            "job_platform": job.platform if job else None,
            "job_model": job.model if job else None,
            "job_created_at": job.created_at.isoformat() if job and job.created_at else None,
        })
    return by_annotation


def _serialize_training_annotation(row: TrainingAnnotation, links: List[Dict[str, Any]]) -> Dict[str, Any]:
    linked_jobs = links or []
    return {
        "id": row.id,
        "instruction": row.instruction,
        "response": row.response,
        "score": row.score,
        "training_item_id": row.training_item_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "finetuned": len(linked_jobs) > 0,
        "finetuned_count": len(linked_jobs),
        "linked_jobs": linked_jobs,
    }


@router.get("/training-items")
async def list_training_items(db: Session = Depends(get_db)):
    """List persisted training items."""
    items = db.query(TrainingItem).order_by(TrainingItem.updated_at.desc(), TrainingItem.id.desc()).all()
    return {"items": [_serialize_training_item(item) for item in items]}


@router.post("/training-items")
async def save_training_item(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create or update training item by unique name."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    keys = body.get("knowledge_point_keys", [])
    if isinstance(keys, str):
        try:
            keys = json.loads(keys)
        except Exception:
            keys = []
    if not isinstance(keys, list):
        keys = []
    knowledge_point_keys = [str(v).strip() for v in keys if str(v).strip()]

    prompt_template = (body.get("prompt_template") or "").strip()
    if not prompt_template:
        raise HTTPException(status_code=400, detail="prompt_template is required")

    try:
        existing = db.query(TrainingItem).filter(TrainingItem.name == name).first()
        if existing:
            existing.knowledge_point_keys = json.dumps(knowledge_point_keys, ensure_ascii=False)
            existing.prompt_template = prompt_template
            db.commit()
            db.refresh(existing)
            return _serialize_training_item(existing)

        item = TrainingItem(
            name=name,
            knowledge_point_keys=json.dumps(knowledge_point_keys, ensure_ascii=False),
            prompt_template=prompt_template,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return _serialize_training_item(item)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/training-items/{item_id}")
async def delete_training_item(item_id: int, db: Session = Depends(get_db)):
    """Delete a training item by id."""
    try:
        item = db.query(TrainingItem).filter(TrainingItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Training item not found")
        db.delete(item)
        db.commit()
        return {"success": True, "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/training-set")
async def save_training_set(request: Dict[str, Any], db: Session = Depends(get_db)):
    """Save current annotations for fine-tuning into database."""
    annotations = request.get("annotations", [])
    training_item_id = request.get("training_item_id")
    if training_item_id is not None:
        try:
            training_item_id = int(training_item_id)
        except Exception:
            raise HTTPException(status_code=400, detail="training_item_id must be integer")

    try:
        if training_item_id is not None:
            item = db.query(TrainingItem).filter(TrainingItem.id == training_item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail="Training item not found")

        saved_count = 0
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            instruction = (ann.get("instruction") or "").strip()
            response = (ann.get("response") or "").strip()
            if not instruction or not response:
                continue
            score_val = ann.get("score")
            score = None
            if score_val is not None and str(score_val).strip() != "":
                try:
                    score = int(score_val)
                except Exception:
                    score = None
            db.add(TrainingAnnotation(
                training_item_id=training_item_id,
                instruction=instruction,
                response=response,
                score=score,
            ))
            saved_count += 1

        db.commit()
        return {"success": True, "count": saved_count}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training-set")
async def get_training_set(training_item_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """Get saved training set from database, optionally by training item."""
    if training_item_id is None:
        existing_count = db.query(TrainingAnnotation).count()
        if existing_count == 0 and os.path.exists(TRAINING_SET_PATH):
            try:
                with open(TRAINING_SET_PATH, "r", encoding="utf-8") as f:
                    legacy_data = json.load(f)
                legacy_annotations = legacy_data.get("annotations", []) if isinstance(legacy_data, dict) else []
                for ann in legacy_annotations:
                    if not isinstance(ann, dict):
                        continue
                    instruction = (ann.get("instruction") or "").strip()
                    response = (ann.get("response") or "").strip()
                    if not instruction or not response:
                        continue
                    score_val = ann.get("score")
                    score = None
                    if score_val is not None and str(score_val).strip() != "":
                        try:
                            score = int(score_val)
                        except Exception:
                            score = None
                    db.add(TrainingAnnotation(
                        training_item_id=None,
                        instruction=instruction,
                        response=response,
                        score=score,
                    ))
                db.commit()
            except Exception:
                db.rollback()

    query = db.query(TrainingAnnotation)
    if training_item_id is not None:
        query = query.filter(TrainingAnnotation.training_item_id == training_item_id)

    rows = query.order_by(TrainingAnnotation.created_at.desc(), TrainingAnnotation.id.desc()).all()
    row_ids = [row.id for row in rows if row.id is not None]
    link_map = _collect_training_annotation_link_info(db, row_ids)
    annotations_out = [
        _serialize_training_annotation(row, link_map.get(row.id, []))
        for row in rows
    ]
    return {"annotations": annotations_out, "count": len(annotations_out)}
