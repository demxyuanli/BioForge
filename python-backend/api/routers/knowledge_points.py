"""
Knowledge points: list, create, batch delete, weight, excluded, keywords.
"""
import json
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Body, Query, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import Document, KnowledgePoint
from api.db import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


def _kp_keywords_list(kp: KnowledgePoint) -> list:
    out = []
    if getattr(kp, "keywords", None):
        try:
            out = json.loads(kp.keywords)
            if not isinstance(out, list):
                out = []
        except Exception:
            out = []
    return out


def _serialize_kp(kp: KnowledgePoint, doc: Document) -> Dict[str, Any]:
    return {
        "id": kp.id,
        "content": kp.content,
        "document_id": doc.id,
        "document_name": doc.filename,
        "chunk_index": kp.chunk_index,
        "weight": getattr(kp, "weight", 1.0),
        "excluded": bool(getattr(kp, "excluded", False)),
        "is_manual": bool(getattr(kp, "is_manual", False)),
        "keywords": _kp_keywords_list(kp),
    }


@router.get("/documents/knowledge-points")
async def list_knowledge_points(
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
    document_id: Optional[int] = Query(None),
    min_weight: Optional[float] = Query(None, description="Min weight 1-5"),
):
    """List knowledge points with pagination. Filter by document_id and/or min_weight when provided."""
    try:
        query = db.query(KnowledgePoint, Document).join(Document, KnowledgePoint.document_id == Document.id)

        if document_id is not None:
            query = query.filter(KnowledgePoint.document_id == document_id)
        if min_weight is not None:
            w = float(min_weight)
            query = query.filter(KnowledgePoint.weight >= w)
        query = query.filter(KnowledgePoint.excluded == False)

        total = query.count()
        points = query.order_by(KnowledgePoint.document_id, KnowledgePoint.chunk_index).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        result = [_serialize_kp(kp, doc) for kp, doc in points if kp.content]

        return {"knowledge_points": result, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/knowledge-points")
async def create_manual_knowledge_point(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create a manual (user-added) knowledge point for a document."""
    document_id = body.get("document_id")
    content = (body.get("content") or "").strip()
    if document_id is None:
        raise HTTPException(status_code=400, detail="document_id is required")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        max_idx = db.query(func.coalesce(func.max(KnowledgePoint.chunk_index), -1)).filter(
            KnowledgePoint.document_id == document_id
        ).scalar() or -1
        next_index = max_idx + 1
        kp = KnowledgePoint(
            document_id=document_id,
            content=content,
            chunk_index=next_index,
            weight=1.0,
            excluded=False,
            is_manual=True,
        )
        db.add(kp)
        db.commit()
        db.refresh(kp)
        out = _serialize_kp(kp, doc)
        out["is_manual"] = True
        return out
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/knowledge-points/batch")
async def delete_knowledge_points_batch(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Batch delete knowledge points by ids. Removes from DB and vector store."""
    ids = body.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids must be a non-empty list")
    try:
        points = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(ids)).all()
        if not points:
            return {"deleted": 0, "message": "No matching knowledge points"}
        doc_chunks = {}
        for kp in points:
            doc_id = kp.document_id
            if doc_id not in doc_chunks:
                doc_chunks[doc_id] = []
            doc_chunks[doc_id].append(kp.chunk_index)
            db.delete(kp)
        db.commit()
        try:
            from services.rag_service import RAGService
            rag = RAGService()
            for doc_id, chunk_indices in doc_chunks.items():
                if rag.client and chunk_indices:
                    rag.delete_chunks(doc_id, chunk_indices)
        except Exception as e:
            logger.warning("Failed to delete chunks from vector store: %s", e)
        return {"deleted": len(points)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/documents/knowledge-points/{kp_id}")
async def update_knowledge_point_weight(kp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update knowledge point weight."""
    weight = body.get("weight")
    if weight is None or not isinstance(weight, (int, float)):
        raise HTTPException(status_code=400, detail="weight must be a number")
    weight = float(weight)
    if weight < 1 or weight > 5:
        raise HTTPException(status_code=400, detail="weight must be between 1 and 5 (star rating)")
    try:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        kp.weight = weight
        db.commit()
        return {"id": kp_id, "weight": weight}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/documents/knowledge-points/{kp_id}/excluded")
async def update_knowledge_point_excluded(kp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update knowledge point excluded (soft delete) state."""
    excluded = body.get("excluded")
    if excluded is None or not isinstance(excluded, bool):
        raise HTTPException(status_code=400, detail="excluded must be a boolean")
    try:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        kp.excluded = excluded
        db.commit()
        return {"id": kp_id, "excluded": excluded}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/knowledge-points/{kp_id}/keywords")
async def add_knowledge_point_keyword(kp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Add a keyword to a knowledge point."""
    keyword = (body.get("keyword") or "").strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    try:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            raise HTTPException(status_code=404, detail="Knowledge point not found")

        keywords_list = _kp_keywords_list(kp)
        if keyword not in keywords_list:
            keywords_list.append(keyword)
            kp.keywords = json.dumps(keywords_list, ensure_ascii=False)
            db.commit()

        return {"id": kp_id, "keywords": keywords_list}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/knowledge-points/{kp_id}/keywords")
async def remove_knowledge_point_keyword(kp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Remove a keyword from a knowledge point."""
    keyword = (body.get("keyword") or "").strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    try:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            raise HTTPException(status_code=404, detail="Knowledge point not found")

        keywords_list = _kp_keywords_list(kp)
        if keyword in keywords_list:
            keywords_list.remove(keyword)
            kp.keywords = json.dumps(keywords_list, ensure_ascii=False) if keywords_list else None
            db.commit()

        return {"id": kp_id, "keywords": keywords_list}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/knowledge-points/{kp_id}/keywords")
async def get_knowledge_point_keywords(kp_id: int, db: Session = Depends(get_db)):
    """Get keywords for a knowledge point."""
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
    if not kp:
        raise HTTPException(status_code=404, detail="Knowledge point not found")
    keywords_list = _kp_keywords_list(kp)
    return {"id": kp_id, "keywords": keywords_list}
