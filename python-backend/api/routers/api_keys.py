"""API key (privacy center) routes."""
import os
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database.models import APIKey
from api.db import get_db
from api.shared import BACKEND_DIR, AUDIT_LOG_PATH

router = APIRouter()


@router.post("/api-keys")
async def save_api_key(request: dict, db: Session = Depends(get_db)):
    """Save API key (encrypted) for a platform."""
    platform = (request.get("platform") or "").strip().lower()
    api_key = (request.get("api_key") or "").strip()
    if not platform or not api_key:
        raise HTTPException(status_code=400, detail="platform and api_key required")
    from services.security_service import SecurityService
    key_file = os.path.join(BACKEND_DIR, ".encryption_key")
    security = SecurityService(key_file=key_file)
    encrypted = security.encrypt_api_key(api_key)
    try:
        existing = db.query(APIKey).filter(APIKey.platform == platform).first()
        if existing:
            existing.encrypted_key = encrypted
        else:
            db.add(APIKey(platform=platform, encrypted_key=encrypted))
        db.commit()
        security.log_audit_event("api_key_save", {"platform": platform}, AUDIT_LOG_PATH)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(db: Session = Depends(get_db)):
    """List stored API key platforms (no actual keys returned)."""
    keys = db.query(APIKey).all()
    return [{"platform": k.platform, "encrypted": True} for k in keys]
