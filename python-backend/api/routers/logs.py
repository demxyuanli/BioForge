"""Audit and desensitization log routes."""
import json
import os
from fastapi import APIRouter
from api.shared import AUDIT_LOG_PATH, DESENSITIZATION_LOG_PATH

router = APIRouter()


@router.get("/audit-log")
async def get_audit_log(limit: int = 200):
    """Get recent audit log entries."""
    if not os.path.exists(AUDIT_LOG_PATH):
        return {"entries": []}
    with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
    entries = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except Exception:
            entries.append({"raw": line})
    return {"entries": entries}


@router.get("/desensitization-log")
async def get_desensitization_log(limit: int = 100):
    """Get recent desensitization log entries."""
    if not os.path.exists(DESENSITIZATION_LOG_PATH):
        return {"entries": []}
    with open(DESENSITIZATION_LOG_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
    entries = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except Exception:
            entries.append({"raw": line})
    return {"entries": entries}
