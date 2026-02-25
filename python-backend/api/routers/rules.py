"""Rules CRUD: constraints and policies - answers 'what is allowed / not allowed'. Reusable across skills."""
import json
from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from database.models import Rule
from api.db import get_db

router = APIRouter()


def _rule_to_dict(r: Rule) -> Dict[str, Any]:
    return {
        "id": r.id,
        "name": r.name or "",
        "category": (r.category or "").strip() or None,
        "content": (r.content or "").strip() or None,
        "enabled": bool(r.enabled) if r.enabled is not None else True,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/rules")
async def list_rules(db: Session = Depends(get_db)):
    """List all rules, ordered by updated_at desc."""
    rules = db.query(Rule).order_by(Rule.updated_at.desc()).all()
    return [_rule_to_dict(r) for r in rules]


@router.post("/rules")
async def create_rule(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create a rule. name required."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    category = (body.get("category") or "").strip() or None
    content = (body.get("content") or "").strip() or None
    enabled = body.get("enabled", True)
    if not isinstance(enabled, bool):
        enabled = True
    try:
        r = Rule(name=name, category=category, content=content, enabled=enabled)
        db.add(r)
        db.commit()
        db.refresh(r)
        return _rule_to_dict(r)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/{rule_id}")
async def get_rule(rule_id: int, db: Session = Depends(get_db)):
    """Get one rule by id."""
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _rule_to_dict(r)


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: int, body: Dict[str, Any] = Body(default=None), db: Session = Depends(get_db)):
    """Update a rule (name, category, content, enabled)."""
    if body is None:
        body = {}
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    if "name" in body:
        name = (body.get("name") or "").strip()
        r.name = name if name else (r.name or "Rule")
    if "category" in body:
        r.category = (body.get("category") or "").strip() or None
    if "content" in body:
        r.content = (body.get("content") or "").strip() or None
    if "enabled" in body and isinstance(body["enabled"], bool):
        r.enabled = body["enabled"]
    try:
        db.commit()
        db.refresh(r)
        return _rule_to_dict(r)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a rule."""
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    try:
        db.delete(r)
        db.commit()
        return {"deleted": rule_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
