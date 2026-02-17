"""
RAG and app config endpoints.
"""
import json
import os
from fastapi import APIRouter
from api.shared import RAG_CONFIG_PATH

router = APIRouter()

DEFAULT_RAG_CONFIG = {
    "chunkSize": 500,
    "contextWindow": 5,
    "useHybrid": True,
    "embeddingModel": "",
    "embeddingBaseUrl": "",
    "embeddingPlatform": "deepseek",
}


def _load_rag_config() -> dict:
    if not os.path.exists(RAG_CONFIG_PATH):
        return dict(DEFAULT_RAG_CONFIG)
    try:
        with open(RAG_CONFIG_PATH, encoding="utf-8") as f:
            data = json.load(f)
        out = dict(DEFAULT_RAG_CONFIG)
        for k, v in data.items():
            if k in out:
                out[k] = v
        return out
    except Exception:
        return dict(DEFAULT_RAG_CONFIG)


def get_rag_config_for_service() -> dict:
    """Load RAG config for use by RAGService (e.g. after resolving API key in caller)."""
    return _load_rag_config()


def _save_rag_config(data: dict) -> None:
    out = _load_rag_config()
    for k in DEFAULT_RAG_CONFIG:
        if k in data:
            out[k] = data[k]
    os.makedirs(os.path.dirname(RAG_CONFIG_PATH), exist_ok=True)
    with open(RAG_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)


@router.get("/config/rag")
async def get_rag_config():
    return _load_rag_config()


@router.post("/config/rag")
async def save_rag_config(body: dict):
    allowed = set(DEFAULT_RAG_CONFIG.keys())
    payload = {k: v for k, v in (body or {}).items() if k in allowed}
    _save_rag_config(payload)
    return _load_rag_config()
