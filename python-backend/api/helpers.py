"""
Shared API helpers (e.g. resolve API key from store).
"""
import os
from api.db import get_db_session
from api.shared import BACKEND_DIR
from database.models import APIKey


def resolve_api_key(platform: str) -> str:
    """Resolve decrypted API key by platform from stored keys. Returns empty string if not found."""
    if not platform or not platform.strip():
        return ""
    platform = platform.strip().lower()
    db = get_db_session()
    try:
        row = db.query(APIKey).filter(APIKey.platform == platform).first()
        if not row or not row.encrypted_key:
            return ""
        from services.security_service import SecurityService
        key_file = os.path.join(BACKEND_DIR, ".encryption_key")
        security = SecurityService(key_file=key_file)
        return security.decrypt_api_key(row.encrypted_key)
    except Exception:
        return ""
    finally:
        db.close()
