"""
Database engine and session dependency for FastAPI.
"""
import os
from typing import Generator
from sqlalchemy.orm import Session
from database.models import init_database

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")

def _resolve_db_path() -> str:
    env = os.getenv("BIOFORGER_DB_PATH")
    if env:
        return env

    preferred = os.path.join(BACKEND_DIR, "aiforger.db")
    legacy = os.path.join(BACKEND_DIR, "privatetune.db")

    if os.path.exists(preferred):
        return preferred
    if os.path.exists(legacy):
        return legacy
    return preferred


_db_path = _resolve_db_path()
engine = init_database(_db_path)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a DB session and close it after request."""
    db = Session(engine)
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    """Return a new session for one-off use (caller must close)."""
    return Session(engine)
