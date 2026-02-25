"""
Full-text search over indexed document/knowledge point content.
"""
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session

from api.db import engine, get_db
from services.fulltext_service import search as fts_search, rebuild_fts_index
from database.models import Document

router = APIRouter()


@router.post("/fulltext-search/rebuild")
async def rebuild_fulltext_index():
    """Rebuild full-text index from all knowledge points. Call once after upgrade or when search is empty."""
    count = rebuild_fts_index(engine)
    return {"indexed": count}


@router.get("/fulltext-search")
async def search_fulltext(q: str = Query(..., min_length=1, max_length=500), db: Session = Depends(get_db)):
    """
    Full-text search over parsed content (knowledge points).
    Returns document_id, knowledge_point_id, snippet, and filename.
    """
    hits = fts_search(engine, q, limit=50)
    if not hits:
        return {"query": q, "results": []}
    doc_ids = list({h["document_id"] for h in hits})
    docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()
    filename_by_id = {d.id: d.filename or "" for d in docs}
    for h in hits:
        h["filename"] = filename_by_id.get(h["document_id"], "")
    return {"query": q, "results": hits}
