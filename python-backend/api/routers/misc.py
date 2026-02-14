"""Misc routes: desensitize, models/local."""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from api.shared import DESENSITIZATION_LOG_PATH

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/desensitize")
async def desensitize_text(request: Dict[str, Any] = Body(...)):
    """Desensitize sensitive information in text."""
    from services.desensitization_service import DesensitizationService
    text = request.get("text", "")
    patterns = request.get("patterns")
    service = DesensitizationService()
    result = service.desensitize_text(text, patterns)
    try:
        with open(DESENSITIZATION_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps({"timestamp": datetime.utcnow().isoformat(), "result": result}, ensure_ascii=False) + "\n")
    except Exception:
        pass
    return result


@router.get("/models/local")
async def list_local_models(base_url: str = "http://localhost:11434"):
    """List available local models from Ollama."""
    try:
        import requests
        target_url = base_url.rstrip("/")
        if target_url.endswith("/v1"):
            target_url = target_url[:-3]
        try:
            resp = requests.get(f"{target_url}/api/tags", timeout=2)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                return {"models": [m["name"] for m in models]}
        except Exception:
            pass
        try:
            resp = requests.get(f"{target_url}/v1/models", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                return {"models": [m["id"] for m in data.get("data", [])]}
        except Exception:
            pass
        return {"models": []}
    except Exception as e:
        logger.error("Failed to list local models: %s", e)
        return {"models": [], "error": str(e)}
