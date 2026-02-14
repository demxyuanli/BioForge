"""Evaluation (generate content for before/after comparison) routes."""
import logging
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from api.helpers import resolve_api_key

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/evaluation/generate")
async def evaluation_generate(body: Dict[str, Any] = Body(...)):
    """Generate content for evaluation (before/after comparison)."""
    from services.evaluation_service import EvaluationService
    prompt = (body.get("prompt") or "").strip()
    template_name = body.get("template", "custom")
    model_endpoint = body.get("model_endpoint")
    api_key = (body.get("api_key") or "").strip() or ""
    platform = (body.get("platform") or "").strip().lower()
    if not api_key and platform:
        api_key = resolve_api_key(platform)
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt required")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="The api_key client option must be set either by passing api_key to the client or by setting the OPENAI_API_KEY environment variable",
        )
    service = EvaluationService(api_key=api_key)
    template_text = service.get_template(template_name) if hasattr(service, "get_template") else ""
    if not template_text:
        template_text = (
            "# Output format (Markdown)\n\n"
            "Generate professional content. **Output in Markdown.** Use headings (##) and paragraphs as appropriate.\n\n"
            "## User request\n\n{prompt}\n\n---\nOutput the full content in Markdown. Use the same language as the user request."
        )
    context = {
        "prompt": prompt,
        "title": prompt,
        "client": prompt,
        "objective": prompt,
        "scope": prompt,
        "timeline": prompt,
        "budget": prompt,
        "project_name": prompt,
        "requirements": prompt,
        "tech_stack": prompt,
        "architecture": prompt,
        "abstract": prompt,
        "keywords": prompt,
        "introduction": prompt,
        "methodology": prompt,
        "results": prompt,
        "discussion": prompt,
    }
    result = service.generate_content(template_text, context, model_endpoint, api_key)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result
