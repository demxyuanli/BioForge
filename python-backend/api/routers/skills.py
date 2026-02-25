"""Skills CRUD: executable capabilities - answers 'how to do'. Can link to Rules (constraints)."""
import json
from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from database.models import Skill, SkillRule, ensure_default_skills
from api.db import get_db

router = APIRouter()


def _skill_rule_ids(skill_id: int, db: Session) -> List[int]:
    rows = db.execute(select(SkillRule.rule_id).where(SkillRule.skill_id == skill_id)).scalars().all()
    return list(rows) if rows else []


def _set_skill_rules(db: Session, skill_id: int, rule_ids: List[int]) -> None:
    db.execute(delete(SkillRule).where(SkillRule.skill_id == skill_id))
    for rid in rule_ids or []:
        db.add(SkillRule(skill_id=skill_id, rule_id=rid))


def _skill_to_dict(s: Skill, db: Session) -> Dict[str, Any]:
    config = None
    if s.config:
        try:
            config = json.loads(s.config)
        except (json.JSONDecodeError, TypeError):
            config = {}
    return {
        "id": s.id,
        "name": s.name or "",
        "description": s.description or "",
        "type": s.type or "custom",
        "config": config,
        "rule": (s.rule or "").strip() or None,
        "trigger_conditions": (s.trigger_conditions or "").strip() or None,
        "steps": (s.steps or "").strip() or None,
        "output_description": (s.output_description or "").strip() or None,
        "example": (s.example or "").strip() or None,
        "rule_ids": _skill_rule_ids(s.id, db),
        "enabled": bool(s.enabled) if s.enabled is not None else True,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/skills")
async def list_skills(db: Session = Depends(get_db)):
    """List all skills, ordered by updated_at desc. Seeds default skills if table is empty."""
    ensure_default_skills(db)
    skills = db.query(Skill).order_by(Skill.updated_at.desc()).all()
    return [_skill_to_dict(s, db) for s in skills]


@router.post("/skills")
async def create_skill(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create a skill. name and type required."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    skill_type = (body.get("type") or "custom").strip() or "custom"
    description = (body.get("description") or "").strip() or None
    config = body.get("config")
    if config is not None and not isinstance(config, dict):
        config = None
    config_str = json.dumps(config) if config else None
    rule = (body.get("rule") or "").strip() or None
    trigger_conditions = (body.get("trigger_conditions") or "").strip() or None
    steps = (body.get("steps") or "").strip() or None
    output_description = (body.get("output_description") or "").strip() or None
    example = (body.get("example") or "").strip() or None
    rule_ids = body.get("rule_ids")
    if rule_ids is not None and not isinstance(rule_ids, list):
        rule_ids = []
    if rule_ids is not None:
        rule_ids = [int(x) for x in rule_ids if isinstance(x, (int, float)) or (isinstance(x, str) and str(x).isdigit())]
    enabled = body.get("enabled", True)
    if not isinstance(enabled, bool):
        enabled = True
    try:
        s = Skill(
            name=name,
            description=description,
            type=skill_type,
            config=config_str,
            rule=rule,
            trigger_conditions=trigger_conditions,
            steps=steps,
            output_description=output_description,
            example=example,
            enabled=enabled,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        _set_skill_rules(db, s.id, rule_ids)
        db.commit()
        db.refresh(s)
        return _skill_to_dict(s, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skills/{skill_id}")
async def get_skill(skill_id: int, db: Session = Depends(get_db)):
    """Get one skill by id."""
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Skill not found")
    return _skill_to_dict(s, db)


@router.patch("/skills/{skill_id}")
async def update_skill(skill_id: int, body: Dict[str, Any] = Body(default=None), db: Session = Depends(get_db)):
    """Update a skill (name, description, type, config, enabled)."""
    if body is None:
        body = {}
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Skill not found")
    if "name" in body:
        name = (body.get("name") or "").strip()
        s.name = name if name else (s.name or "Skill")
    if "description" in body:
        s.description = (body.get("description") or "").strip() or None
    if "type" in body:
        t = (body.get("type") or "custom").strip() or "custom"
        s.type = t
    if "config" in body:
        config = body.get("config")
        s.config = json.dumps(config) if isinstance(config, dict) else (json.dumps({}) if config is None else None)
    if "rule" in body:
        s.rule = (body.get("rule") or "").strip() or None
    if "trigger_conditions" in body:
        s.trigger_conditions = (body.get("trigger_conditions") or "").strip() or None
    if "steps" in body:
        s.steps = (body.get("steps") or "").strip() or None
    if "output_description" in body:
        s.output_description = (body.get("output_description") or "").strip() or None
    if "example" in body:
        s.example = (body.get("example") or "").strip() or None
    if "enabled" in body and isinstance(body["enabled"], bool):
        s.enabled = body["enabled"]
    try:
        db.commit()
        db.refresh(s)
        if "rule_ids" in body:
            rule_ids = body.get("rule_ids")
            if rule_ids is not None and isinstance(rule_ids, list):
                rule_ids = [int(x) for x in rule_ids if isinstance(x, (int, float)) or (isinstance(x, str) and str(x).isdigit())]
            else:
                rule_ids = []
            _set_skill_rules(db, s.id, rule_ids)
            db.commit()
            db.refresh(s)
        return _skill_to_dict(s, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: int, db: Session = Depends(get_db)):
    """Delete a skill."""
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Skill not found")
    try:
        db.delete(s)
        db.commit()
        return {"deleted": skill_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
