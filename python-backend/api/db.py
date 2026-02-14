"""
Database engine and session dependency for FastAPI.
"""
import os
from typing import Generator
from sqlalchemy.orm import Session
from database.models import init_database

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
_db_path = os.getenv("BIOFORGER_DB_PATH") or os.path.join(BACKEND_DIR, "privatetune.db")
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
