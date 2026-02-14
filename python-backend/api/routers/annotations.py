"""
Annotations: generate instruction pairs from knowledge points.
"""
import re
import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Body
from api.helpers import resolve_api_key

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/annotations/generate")
async def generate_annotations(body: Dict[str, Any] = Body(...)):
    """Generate instruction pairs from knowledge points."""
    from services.annotation_service import AnnotationService

    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        import json as json_module
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
    try:
        candidate_count = int(candidate_count)
    except Exception:
        candidate_count = 1
    candidate_count = max(1, min(10, candidate_count))

    if not api_key and platform:
        api_key = resolve_api_key(platform)

    logger.info(
        "annotations/generate: request received, knowledge_points_count=%d, candidate_count=%d, model=%s, api_key_set=%s",
        len(knowledge_points), candidate_count, model, bool(api_key),
    )

    service = AnnotationService(api_key=api_key if api_key else None, model=model, base_url=base_url)
    annotations = []
    errors = []
    seen_pairs = set()

    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    for i, kp in enumerate(knowledge_points):
        candidate_result = service.generate_instruction_candidates(kp, candidate_count)
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
