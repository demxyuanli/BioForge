"""Mount points (OS directories) and file meta routes."""
import os
import hashlib
import tempfile
import shutil
from fastapi import APIRouter, HTTPException, Body, Query, Depends
from fastapi.responses import Response
from typing import Dict, Any
from sqlalchemy.orm import Session
from database.models import MountPoint, MountPointFileMeta
from api.db import get_db
from api.shared import (
    DOC_EXTENSIONS,
    normalize_path,
    dirname_from_path,
    is_temp_or_hidden_file,
    file_version,
    preview_cache_path,
)
from services.libreoffice_parser import is_office_extension, convert_to_pdf

router = APIRouter()
RECENT_ANNOTATED_LIMIT = 10


@router.get("/mount-points")
async def list_mount_points(db: Session = Depends(get_db)):
    """List all mount points. Deduplicated by path."""
    points = db.query(MountPoint).order_by(MountPoint.created_at.desc()).all()
    seen_paths = set()
    result = []
    for mp in points:
        norm = normalize_path(mp.path)
        if norm and norm not in seen_paths:
            seen_paths.add(norm)
            result.append({
                "id": mp.id,
                "path": mp.path,
                "name": mp.name or "",
                "description": mp.description or "",
                "created_at": mp.created_at.isoformat() if mp.created_at else None,
            })
    return result


@router.post("/mount-points")
async def create_mount_point(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Add a mount point. Path is unique; duplicate returns existing."""
    path = (body.get("path") or "").strip()
    description = (body.get("description") or "").strip() or None
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    name = dirname_from_path(path) or None
    norm = normalize_path(path)
    all_mp = db.query(MountPoint).all()
    existing = next((mp for mp in all_mp if normalize_path(mp.path) == norm), None)
    if existing:
        return {
            "id": existing.id,
            "path": existing.path,
            "name": existing.name or "",
            "description": existing.description or "",
            "created_at": existing.created_at.isoformat() if existing.created_at else None,
        }
    try:
        mp = MountPoint(path=path, name=name, description=description)
        db.add(mp)
        db.commit()
        db.refresh(mp)
        return {
            "id": mp.id,
            "path": mp.path,
            "name": mp.name or "",
            "description": mp.description or "",
            "created_at": mp.created_at.isoformat() if mp.created_at else None,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/recent-annotated-files")
async def get_recent_annotated_files(db: Session = Depends(get_db)):
    """Return mount point files that have a note, limit 10."""
    rows = (
        db.query(MountPointFileMeta, MountPoint)
        .join(MountPoint, MountPointFileMeta.mount_point_id == MountPoint.id)
        .filter(MountPointFileMeta.note.isnot(None))
        .filter(MountPointFileMeta.note != "")
        .order_by(MountPointFileMeta.updated_at.desc())
        .limit(RECENT_ANNOTATED_LIMIT)
        .all()
    )
    out = []
    for meta, mp in rows:
        rel = (meta.relative_path or "").replace("\\", "/")
        filename = rel.split("/")[-1] if rel else ""
        out.append({
            "mount_point_id": mp.id,
            "mount_point_name": (mp.name or mp.path or "").strip(),
            "relative_path": rel,
            "filename": filename,
            "note": (meta.note or "").strip(),
            "updated_at": meta.updated_at.isoformat() if meta.updated_at else None,
        })
    return {"items": out}


@router.get("/mount-points/{mp_id}/document-stats")
async def get_mount_point_document_stats(mp_id: int, db: Session = Depends(get_db)):
    """Return document counts inside the mount point by type."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    path = (mp.path or "").strip()
    if not path or not os.path.isdir(path):
        return {"total": 0, "by_type": {}}
    by_type = {}
    total = 0
    try:
        for root, dirs, files in os.walk(path, topdown=True):
            for f in files:
                if is_temp_or_hidden_file(f):
                    continue
                ext = os.path.splitext(f)[1]
                if ext:
                    ext = ext[1:].lower()
                if ext not in DOC_EXTENSIONS:
                    continue
                if ext == "jpeg":
                    ext = "jpg"
                by_type[ext] = by_type.get(ext, 0) + 1
                total += 1
    except (OSError, PermissionError):
        pass
    return {"total": total, "by_type": by_type}


@router.get("/mount-points/{mp_id}/files")
async def get_mount_point_files(mp_id: int, db: Session = Depends(get_db)):
    """Return document file paths inside the mount point, grouped by extension."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    path = (mp.path or "").strip()
    if not path or not os.path.isdir(path):
        meta_list = db.query(MountPointFileMeta).filter(MountPointFileMeta.mount_point_id == mp_id).all()
        file_meta = {m.relative_path: {"weight": getattr(m, "weight", 1.0), "note": m.note or ""} for m in meta_list}
        return {"by_type": {}, "file_meta": file_meta}
    path_rstrip = path.rstrip(os.sep)
    by_type = {}
    try:
        for root, dirs, files in os.walk(path, topdown=True):
            for f in files:
                if is_temp_or_hidden_file(f):
                    continue
                ext = os.path.splitext(f)[1]
                if ext:
                    ext = ext[1:].lower()
                if ext not in DOC_EXTENSIONS:
                    continue
                if ext == "jpeg":
                    ext = "jpg"
                full = os.path.join(root, f)
                try:
                    rel = os.path.relpath(full, path_rstrip)
                except ValueError:
                    rel = full
                by_type.setdefault(ext, []).append(rel.replace("\\", "/"))
    except (OSError, PermissionError):
        pass
    meta_list = db.query(MountPointFileMeta).filter(MountPointFileMeta.mount_point_id == mp_id).all()
    file_meta = {m.relative_path: {"weight": getattr(m, "weight", 1.0), "note": m.note or ""} for m in meta_list}
    return {"by_type": by_type, "file_meta": file_meta}


@router.patch("/mount-points/{mp_id}/files/meta")
async def update_mount_point_file_meta(mp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Upsert weight/note for one file in the mount point."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    rel = (body.get("relative_path") or "").strip()
    if not rel:
        raise HTTPException(status_code=400, detail="relative_path is required")
    rel = rel.replace("\\", "/")
    meta = db.query(MountPointFileMeta).filter(
        MountPointFileMeta.mount_point_id == mp_id,
        MountPointFileMeta.relative_path == rel,
    ).first()
    if meta is None:
        meta = MountPointFileMeta(mount_point_id=mp_id, relative_path=rel, weight=1.0, note=None)
        db.add(meta)
    if "weight" in body and body["weight"] is not None:
        w = body["weight"]
        if isinstance(w, (int, float)):
            w = max(0.0, min(5.0, float(w)))
            meta.weight = w
    if "note" in body:
        meta.note = (body["note"] or "").strip() or None
    try:
        db.commit()
        db.refresh(meta)
        return {"relative_path": meta.relative_path, "weight": meta.weight, "note": meta.note or ""}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/document-summary")
async def get_document_summary(
    mp_id: int = Query(..., alias="mp_id"),
    relative_path: str = Query(..., alias="relative_path"),
    db: Session = Depends(get_db),
):
    """Placeholder for local AI document summary. Returns empty summary."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    full_path = os.path.normpath(os.path.join((mp.path or "").strip(), relative_path.replace("/", os.sep)))
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return {"summary": ""}


@router.get("/mount-points/document-preview")
async def get_document_preview(
    mp_id: int = Query(..., alias="mp_id"),
    relative_path: str = Query(..., alias="relative_path"),
    db: Session = Depends(get_db),
):
    """Generate document preview via LibreOffice (PDF). Uses cache when source unchanged."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    full_path = os.path.normpath(os.path.join((mp.path or "").strip(), relative_path.replace("/", os.sep)))
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    version = file_version(full_path)
    ext = (os.path.splitext(relative_path)[1] or "").lstrip(".").lower()
    if ext == "jpeg":
        ext = "jpg"
    if ext == "pdf":
        with open(full_path, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="application/pdf", headers={"X-Preview-Version": version})
    if not is_office_extension(ext):
        raise HTTPException(status_code=400, detail="Preview not supported for this file type")
    cache_key = "mp_{}_{}".format(mp_id, hashlib.md5(relative_path.encode()).hexdigest())
    cache_path = preview_cache_path(cache_key, version)
    if os.path.isfile(cache_path):
        with open(cache_path, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="application/pdf", headers={"X-Preview-Version": version})
    out_dir = tempfile.mkdtemp()
    try:
        pdf_path = convert_to_pdf(full_path, out_dir)
        if not pdf_path or not os.path.isfile(pdf_path):
            raise HTTPException(status_code=502, detail="LibreOffice conversion failed")
        with open(pdf_path, "rb") as f:
            data = f.read()
        try:
            with open(cache_path, "wb") as cf:
                cf.write(data)
        except OSError:
            pass
        return Response(content=data, media_type="application/pdf", headers={"X-Preview-Version": version})
    finally:
        try:
            shutil.rmtree(out_dir, ignore_errors=True)
        except OSError:
            pass


@router.patch("/mount-points/{mp_id}")
async def update_mount_point(mp_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update mount point name or description. Path is immutable."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    if "path" in body and body["path"] is not None:
        raise HTTPException(status_code=400, detail="path is immutable")
    if "name" in body:
        mp.name = (body["name"] or "").strip() or None
    if "description" in body:
        mp.description = (body["description"] or "").strip() or None
    try:
        db.commit()
        db.refresh(mp)
        return {
            "id": mp.id,
            "path": mp.path,
            "name": mp.name or "",
            "description": mp.description or "",
            "created_at": mp.created_at.isoformat() if mp.created_at else None,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/mount-points/{mp_id}")
async def delete_mount_point(mp_id: int, db: Session = Depends(get_db)):
    """Remove a mount point."""
    mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Mount point not found")
    try:
        db.delete(mp)
        db.commit()
        return {"deleted": mp_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/mount-points")
async def delete_all_mount_points(db: Session = Depends(get_db)):
    """Remove all mount points."""
    try:
        count = db.query(MountPoint).delete()
        db.commit()
        return {"deleted": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
