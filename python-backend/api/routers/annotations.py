"""
Annotations: generate instruction pairs from knowledge points.
"""
import json as json_module
import re
import logging
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, Body, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from api.helpers import resolve_api_key
from api.db import get_db
from database.models import Skill, Rule, SkillRule

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


@router.post("/annotations/generate")
async def generate_annotations(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Generate instruction pairs from knowledge points. Optional skill_ids to inject skills context."""
    from services.annotation_service import AnnotationService

    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        try:
            knowledge_points = json_module.loads(knowledge_points)
        except Exception as parse_err:
            logger.warning("annotations/generate: knowledge_points parse failed: %s", parse_err)
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

    logger.info(
        "annotations/generate: request received, knowledge_points_count=%d, candidate_count=%d, model=%s, api_key_set=%s, skills_count=%d",
        len(knowledge_points), candidate_count, model, bool(api_key), len(skill_ids) if skill_ids else 0,
    )

    service = AnnotationService(api_key=api_key if api_key else None, model=model, base_url=base_url)
    annotations = []
    errors = []
    seen_pairs = set()

    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    for i, kp in enumerate(knowledge_points):
        candidate_result = service.generate_instruction_candidates(
            kp, candidate_count, skills_context=skills_context
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
                logger.warning("annotations/generate: kp[%d] failed: %s", i, err_msg)

    logger.info("annotations/generate: done, annotations_count=%d", len(annotations))
    result = {"annotations": annotations}
    if not annotations and errors:
        first_err = errors[0] if errors else ""
        if "402" in first_err or "Insufficient Balance" in first_err:
            result["error"] = "Insufficient Balance (402). Please top up your DeepSeek account."
        else:
            result["error"] = first_err[:200] if len(first_err) > 200 else first_err
    return result
