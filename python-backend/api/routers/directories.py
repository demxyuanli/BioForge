"""Directory and document-move routes."""
from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session
from database.models import Directory, Document, KnowledgePoint
from api.db import get_db

router = APIRouter()


@router.get("/directories")
async def list_directories(db: Session = Depends(get_db)):
    """List all directories and files in tree structure with KP counts via SQL JOIN."""
    try:
        directories = db.query(Directory).all()
        kp_subq = (
            db.query(
                KnowledgePoint.document_id,
                func.count(KnowledgePoint.id).label('kp_count')
            )
            .filter(KnowledgePoint.excluded == False)
            .group_by(KnowledgePoint.document_id)
            .subquery()
        )
        doc_rows = (
            db.query(Document, func.coalesce(kp_subq.c.kp_count, 0))
            .outerjoin(kp_subq, Document.id == kp_subq.c.document_id)
            .all()
        )
        dir_map = {}
        root_dirs = []
        for d in directories:
            dir_map[d.id] = {
                "id": d.id,
                "name": d.name,
                "type": "directory",
                "children": [],
                "parentId": d.parent_id
            }
        root_files = []
        for doc, kp_count in doc_rows:
            file_node = {
                "id": doc.id,
                "name": doc.filename,
                "type": "file",
                "fileType": doc.file_type,
                "processed": doc.processed,
                "uploadTime": doc.upload_time.isoformat() if doc.upload_time else None,
                "directoryId": doc.directory_id,
                "knowledgePointCount": kp_count
            }
            if doc.directory_id and doc.directory_id in dir_map:
                dir_map[doc.directory_id]["children"].append(file_node)
            else:
                root_files.append(file_node)
        for d_id, node in dir_map.items():
            if node["parentId"] and node["parentId"] in dir_map:
                dir_map[node["parentId"]]["children"].append(node)
            else:
                root_dirs.append(node)
        return {"tree": root_dirs + root_files}
    finally:
        pass


@router.post("/directories")
async def create_directory(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create a new directory."""
    name = body.get("name")
    parent_id = body.get("parent_id")
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    try:
        new_dir = Directory(name=name, parent_id=parent_id)
        db.add(new_dir)
        db.commit()
        return {"success": True, "id": new_dir.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documents/{document_id}/move")
async def move_document(document_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Move document to a directory. Updates directory_id in DB only."""
    directory_id = body.get("directory_id")
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        doc.directory_id = directory_id
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/directories/{directory_id}/move")
async def move_directory(directory_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Move directory to another directory."""
    parent_id = body.get("parent_id")
    if directory_id == parent_id:
        raise HTTPException(status_code=400, detail="Cannot move directory into itself")
    try:
        if parent_id:
            current = parent_id
            while current:
                if current == directory_id:
                    raise HTTPException(status_code=400, detail="Circular dependency detected")
                parent = db.query(Directory).filter(Directory.id == current).first()
                current = parent.parent_id if parent else None
        dir_obj = db.query(Directory).filter(Directory.id == directory_id).first()
        if not dir_obj:
            raise HTTPException(status_code=404, detail="Directory not found")
        dir_obj.parent_id = parent_id
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/directories/{directory_id}")
async def delete_directory(directory_id: int, db: Session = Depends(get_db)):
    """Delete a directory (cascade delete is handled by DB)."""
    try:
        dir_obj = db.query(Directory).filter(Directory.id == directory_id).first()
        if not dir_obj:
            raise HTTPException(status_code=404, detail="Directory not found")
        db.delete(dir_obj)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
