"""
API Routes for Python Backend
FastAPI routes for document processing, annotation, and fine-tuning
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Body, BackgroundTasks, Query
from fastapi.responses import Response
from typing import List, Dict, Any, Optional
import os
import json
import logging
import tempfile
import random
import shutil
import hashlib

logger = logging.getLogger(__name__)
from datetime import datetime
from database.models import Document, KnowledgePoint, Annotation as AnnotationModel, FinetuningJob, APIKey, Directory, MountPoint, MountPointFileMeta, TrainingItem, TrainingAnnotation, TrainingAnnotationFinetuningLink, init_database
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from services.libreoffice_parser import is_office_extension, convert_to_pdf

router = APIRouter()

# Initialize database and documents dir from config or defaults
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
db_path = os.getenv("BIOFORGER_DB_PATH") or os.path.join(BACKEND_DIR, "privatetune.db")
engine = init_database(db_path)

# Documents storage directory (multi-dir random storage to avoid single-dir file count limits)
DOCUMENTS_DIR = os.getenv("BIOFORGER_DOCUMENTS_DIR") or os.path.join(BACKEND_DIR, "documents")
STORAGE_SUBDIR_COUNT = 256

def _get_random_storage_dir() -> str:
    subdir = format(random.randint(0, STORAGE_SUBDIR_COUNT - 1), "02x")
    path = os.path.join(DOCUMENTS_DIR, subdir)
    os.makedirs(path, exist_ok=True)
    return path

os.makedirs(DOCUMENTS_DIR, exist_ok=True)

# Preview cache: store converted PDFs by (cache_key, version) to avoid reconversion when file unchanged
PREVIEW_CACHE_DIR = os.getenv("BIOFORGER_PREVIEW_CACHE_DIR") or os.path.join(tempfile.gettempdir(), "bioforger_preview_cache")
os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)


def _file_version(full_path: str) -> str:
    """Version stamp from mtime and size so unchanged file reuses cache."""
    try:
        st = os.stat(full_path)
        return hashlib.sha256(f"{st.st_mtime_ns}_{st.st_size}".encode()).hexdigest()[:24]
    except OSError:
        return "0"


def _preview_cache_path(cache_key: str, version: str) -> str:
    return os.path.join(PREVIEW_CACHE_DIR, f"{cache_key}_{version}.pdf")

# Training set and log paths
TRAINING_SET_PATH = os.path.join(BACKEND_DIR, "training_set.json")
AUDIT_LOG_PATH = os.path.join(BACKEND_DIR, "audit.log")
DESENSITIZATION_LOG_PATH = os.path.join(BACKEND_DIR, "desensitization.log")

def get_db_session():
    return Session(engine)

@router.get("/directories")
async def list_directories():
    """List all directories and files in tree structure"""
    db = get_db_session()
    try:
        directories = db.query(Directory).all()
        documents = db.query(Document).all()
        
        # Build tree
        dir_map = {}
        root_dirs = []
        
        # 1. Create directory nodes
        for d in directories:
            dir_map[d.id] = {
                "id": d.id,
                "name": d.name,
                "type": "directory",
                "children": [],
                "parentId": d.parent_id
            }
            
        # 2. Add files to directory nodes
        root_files = []
        for doc in documents:
            file_node = {
                "id": doc.id,
                "name": doc.filename,
                "type": "file",
                "fileType": doc.file_type,
                "processed": doc.processed,
                "uploadTime": doc.upload_time.isoformat() if doc.upload_time else None,
                "directoryId": doc.directory_id
            }
            if doc.directory_id and doc.directory_id in dir_map:
                dir_map[doc.directory_id]["children"].append(file_node)
            else:
                root_files.append(file_node)
                
        # 3. Assemble directory tree
        for d_id, node in dir_map.items():
            if node["parentId"] and node["parentId"] in dir_map:
                dir_map[node["parentId"]]["children"].append(node)
            else:
                root_dirs.append(node)
                
        return {"tree": root_dirs + root_files}
    finally:
        db.close()

@router.get("/mount-points")
async def list_mount_points():
    """List all mount points (OS directories attached to the system). Deduplicated by path."""
    db = get_db_session()
    try:
        points = db.query(MountPoint).order_by(MountPoint.created_at.desc()).all()
        seen_paths = set()
        result = []
        for mp in points:
            norm = _normalize_path(mp.path)
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
    finally:
        db.close()


def _normalize_path(p: str) -> str:
    return (p or "").replace("\\", "/").rstrip("/").lower()

def _dirname_from_path(p: str) -> str:
    """Last path segment as display name (mount point name = directory name)."""
    p = (p or "").replace("\\", "/").rstrip("/")
    if not p:
        return ""
    return p.split("/")[-1] or ""


@router.post("/mount-points")
async def create_mount_point(body: Dict[str, Any] = Body(...)):
    """Add a mount point: an OS filesystem directory path attached to the system. Path is unique; duplicate returns existing. Name defaults to directory name."""
    path = (body.get("path") or "").strip()
    description = (body.get("description") or "").strip() or None
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    name = _dirname_from_path(path) or None
    db = get_db_session()
    try:
        norm = _normalize_path(path)
        all_mp = db.query(MountPoint).all()
        existing = next((mp for mp in all_mp if _normalize_path(mp.path) == norm), None)
        if existing:
            db.close()
            return {
                "id": existing.id,
                "path": existing.path,
                "name": existing.name or "",
                "description": existing.description or "",
                "created_at": existing.created_at.isoformat() if existing.created_at else None,
            }
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
    finally:
        db.close()


DOC_EXTENSIONS = frozenset([
    "pdf", "doc", "docx", "md", "txt", "jpg", "jpeg", "png",
    "ppt", "pptx", "wps", "rtf"
])

# Filename prefixes that indicate temp/hidden files (excluded from mount point listing)
TEMP_FILENAME_PREFIXES = ("~", "$", ".~", "~$")


def _is_temp_or_hidden_file(basename: str) -> bool:
    """Return True if basename looks like a temp or hidden file (e.g. ~, $, .~lock)."""
    if not basename or not basename.strip():
        return True
    n = basename.strip()
    if n.startswith("."):
        return True
    for p in TEMP_FILENAME_PREFIXES:
        if n.startswith(p):
            return True
    return False


RECENT_ANNOTATED_LIMIT = 10

@router.get("/mount-points/recent-annotated-files")
async def get_recent_annotated_files():
    """Return mount point files that have a note, ordered by updated_at desc, limit 10. Not knowledge-base files."""
    db = get_db_session()
    try:
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
        db.close()
        return {"items": out}
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/{mp_id}/document-stats")
async def get_mount_point_document_stats(mp_id: int):
    """Return document counts inside the mount point (root + all subdirectories recursively). By type for registered extensions."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        path = (mp.path or "").strip()
        db.close()
        if not path or not os.path.isdir(path):
            return {"total": 0, "by_type": {}}
        by_type = {}
        total = 0
        try:
            for root, dirs, files in os.walk(path, topdown=True):
                for f in files:
                    if _is_temp_or_hidden_file(f):
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
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/{mp_id}/files")
async def get_mount_point_files(mp_id: int):
    """Return document file paths inside the mount point, grouped by extension (by_type: ext -> list of relative paths)."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        path = (mp.path or "").strip()
        if not path or not os.path.isdir(path):
            file_meta = {}
            meta_list = db.query(MountPointFileMeta).filter(MountPointFileMeta.mount_point_id == mp_id).all()
            for m in meta_list:
                file_meta[m.relative_path] = {"weight": getattr(m, "weight", 1.0), "note": m.note or ""}
            db.close()
            return {"by_type": {}, "file_meta": file_meta}
        path_rstrip = path.rstrip(os.sep)
        by_type = {}
        try:
            for root, dirs, files in os.walk(path, topdown=True):
                for f in files:
                    if _is_temp_or_hidden_file(f):
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
        file_meta = {}
        meta_list = db.query(MountPointFileMeta).filter(MountPointFileMeta.mount_point_id == mp_id).all()
        for m in meta_list:
            file_meta[m.relative_path] = {"weight": getattr(m, "weight", 1.0), "note": m.note or ""}
        db.close()
        return {"by_type": by_type, "file_meta": file_meta}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/mount-points/{mp_id}/files/meta")
async def update_mount_point_file_meta(mp_id: int, body: Dict[str, Any] = Body(...)):
    """Upsert weight/note for one file in the mount point. Body: relative_path (required), weight (0-5 optional), note (optional)."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        rel = (body.get("relative_path") or "").strip()
        if not rel:
            db.close()
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
        db.commit()
        db.refresh(meta)
        out = {"relative_path": meta.relative_path, "weight": meta.weight, "note": meta.note or ""}
        db.close()
        return out
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/document-summary")
async def get_document_summary(mp_id: int = Query(..., alias="mp_id"), relative_path: str = Query(..., alias="relative_path")):
    """Placeholder for local AI document summary. Returns empty summary (reserved for future)."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        full_path = os.path.normpath(os.path.join((mp.path or "").strip(), relative_path.replace("/", os.sep)))
        if not os.path.isfile(full_path):
            db.close()
            raise HTTPException(status_code=404, detail="File not found")
        db.close()
        return {"summary": ""}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mount-points/document-preview")
async def get_document_preview(mp_id: int = Query(..., alias="mp_id"), relative_path: str = Query(..., alias="relative_path")):
    """Generate document preview via LibreOffice (PDF). Returns PDF with X-Preview-Version. Uses cache when source file unchanged."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        full_path = os.path.normpath(os.path.join((mp.path or "").strip(), relative_path.replace("/", os.sep)))
        if not os.path.isfile(full_path):
            db.close()
            raise HTTPException(status_code=404, detail="File not found")
        version = _file_version(full_path)
        ext = (os.path.splitext(relative_path)[1] or "").lstrip(".").lower()
        if ext == "jpeg":
            ext = "jpg"
        if ext == "pdf":
            with open(full_path, "rb") as f:
                data = f.read()
            db.close()
            return Response(content=data, media_type="application/pdf", headers={"X-Preview-Version": version})
        if not is_office_extension(ext):
            db.close()
            raise HTTPException(status_code=400, detail="Preview not supported for this file type")
        cache_key = "mp_{}_{}".format(mp_id, hashlib.md5(relative_path.encode()).hexdigest())
        cache_path = _preview_cache_path(cache_key, version)
        if os.path.isfile(cache_path):
            with open(cache_path, "rb") as f:
                data = f.read()
            db.close()
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
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/mount-points/{mp_id}")
async def update_mount_point(mp_id: int, body: Dict[str, Any] = Body(...)):
    """Update mount point name or description. Path is immutable (unique key)."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        if "path" in body and body["path"] is not None:
            raise HTTPException(status_code=400, detail="path is immutable")
        if "name" in body:
            mp.name = (body["name"] or "").strip() or None
        if "description" in body:
            mp.description = (body["description"] or "").strip() or None
        db.commit()
        db.refresh(mp)
        return {
            "id": mp.id,
            "path": mp.path,
            "name": mp.name or "",
            "description": mp.description or "",
            "created_at": mp.created_at.isoformat() if mp.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.delete("/mount-points/{mp_id}")
async def delete_mount_point(mp_id: int):
    """Remove a mount point."""
    db = get_db_session()
    try:
        mp = db.query(MountPoint).filter(MountPoint.id == mp_id).first()
        if not mp:
            db.close()
            raise HTTPException(status_code=404, detail="Mount point not found")
        db.delete(mp)
        db.commit()
        return {"deleted": mp_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.delete("/mount-points")
async def delete_all_mount_points():
    """Remove all mount points (file resource data). For reset/re-test."""
    db = get_db_session()
    try:
        count = db.query(MountPoint).delete()
        db.commit()
        return {"deleted": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/directories")
async def create_directory(body: Dict[str, Any] = Body(...)):
    """Create a new directory"""
    name = body.get("name")
    parent_id = body.get("parent_id")
    
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
        
    db = get_db_session()
    try:
        new_dir = Directory(name=name, parent_id=parent_id)
        db.add(new_dir)
        db.commit()
        return {"success": True, "id": new_dir.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.put("/documents/{document_id}/move")
async def move_document(document_id: int, body: Dict[str, Any] = Body(...)):
    """Move document to a directory. Updates directory_id in DB only; no physical file movement."""
    directory_id = body.get("directory_id") # None means root
    
    db = get_db_session()
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
    finally:
        db.close()

@router.put("/directories/{directory_id}/move")
async def move_directory(directory_id: int, body: Dict[str, Any] = Body(...)):
    """Move directory to another directory"""
    parent_id = body.get("parent_id") # None means root
    
    if directory_id == parent_id:
        raise HTTPException(status_code=400, detail="Cannot move directory into itself")
    
    db = get_db_session()
    try:
        # Check for circular dependency
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
    finally:
        db.close()
        
@router.delete("/directories/{directory_id}")
async def delete_directory(directory_id: int):
    """Delete a directory (cascade delete is handled by DB)"""
    db = get_db_session()
    try:
        dir_obj = db.query(Directory).filter(Directory.id == directory_id).first()
        if not dir_obj:
            # Check if directory exists before trying to delete
            # If not found, maybe it was already deleted, so we can return success or 404
            # Returning 404 is more standard
            raise HTTPException(status_code=404, detail="Directory not found")
        
        # Note: Actual file deletion for documents inside needs to be handled if we want to delete physical files
        # For now, let's just delete the DB entries. 
        # Ideally, we should iterate and delete physical files for all documents in this tree.
        # But since SQLite cascade delete might not trigger python logic, we might leave orphan files.
        # A simple approach is to rely on a periodic cleanup task or just keep files.
        # Or recursively delete here.
        
        db.delete(dir_obj)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/documents/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a document and start processing in background"""
    tmp_path = None
    db = None
    try:
        # Save uploaded file to random subdirectory (multi-dir storage to avoid single-dir file limits)
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stored_filename = f"{timestamp}_{safe_filename}"
        storage_dir = _get_random_storage_dir()
        tmp_path = os.path.join(storage_dir, stored_filename)
        
        with open(tmp_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        file_type = os.path.splitext(file.filename)[1][1:].lower()
        
        # Save to database with status 'pending'
        db = get_db_session()
        try:
            doc = Document(
                filename=file.filename,
                file_path=tmp_path,
                file_type=file_type,
                processing_status='pending',
                processing_message='Waiting for processing...',
                processed=False
            )
            db.add(doc)
            db.commit()
            
            # Start background processing
            background_tasks.add_task(process_document_background, doc.id, tmp_path, file_type)
            
            return {"document_id": doc.id, "status": "pending", "message": "Document uploaded and processing started"}
        except Exception as e:
            db.rollback()
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise HTTPException(status_code=500, detail=f"Failed to save document to database: {str(e)}")
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))

def process_document_background(document_id: int, file_path: str, file_type: str):
    """Background task to process document. Non-PDF Office docs are converted to PDF first."""
    db = get_db_session()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        # Convert non-PDF Office documents to PDF so all stored docs are unified as PDF
        if (file_type or "").lower() != "pdf" and is_office_extension((file_type or "").lower()):
            out_dir = os.path.dirname(file_path)
            pdf_path = convert_to_pdf(file_path, out_dir)
            if pdf_path and os.path.isfile(pdf_path):
                try:
                    if os.path.isfile(file_path) and os.path.abspath(file_path) != os.path.abspath(pdf_path):
                        os.remove(file_path)
                except OSError:
                    pass
                doc.file_path = pdf_path
                doc.file_type = "pdf"
                base = os.path.splitext(doc.filename)[0]
                doc.filename = base + ".pdf" if base else "document.pdf"
                db.commit()
                file_path = pdf_path
                file_type = "pdf"

        doc.processing_status = 'processing'
        doc.processing_message = 'Extracting text...'
        db.commit()

        # Process document
        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        result = processor.process_document(file_path, file_type)
        
        if "error" in result:
            doc.processing_status = 'failed'
            doc.processing_message = result.get("error", "Unknown error")
            db.commit()
            return
            
        cleaned_text = result.get("cleaned_text", "")
        if not cleaned_text or len(cleaned_text.strip()) == 0:
            doc.processing_status = 'failed'
            doc.processing_message = "Empty content extracted"
            db.commit()
            return
            
        doc.text_content = cleaned_text
        doc.processing_message = 'Generating knowledge points...'
        db.commit()
        
        # Generate knowledge points
        from services.rag_service import RAGService
        rag = RAGService()
        knowledge_points = rag.structure_document(cleaned_text, str(doc.id))
        
        if knowledge_points and len(knowledge_points) > 0:
            rag.add_to_vector_store(knowledge_points, f"doc_{doc.id}")
        
        for kp in knowledge_points:
            kp_db = KnowledgePoint(
                document_id=doc.id,
                content=kp["content"],
                chunk_index=kp["chunk_index"],
                tags="[]"
            )
            db.add(kp_db)
        
        doc.processed = True
        doc.processing_status = 'completed'
        doc.processing_message = f"Processed successfully. {len(knowledge_points)} knowledge points generated."
        db.commit()
        
    except Exception as e:
        logger.error(f"Background processing failed for doc {document_id}: {e}")
        try:
            doc.processing_status = 'failed'
            doc.processing_message = str(e)
            db.commit()
        except:
            pass
    finally:
        db.close()

@router.get("/documents")
async def list_documents():
    """List all documents"""
    db = None
    try:
        db = get_db_session()
        documents = db.query(Document).all()
        result = [
            {
                "id": doc.id,
                "filename": doc.filename,
                "fileType": doc.file_type,
                "uploadTime": doc.upload_time.isoformat() if doc.upload_time else None,
                "processed": doc.processed,
                "processingStatus": doc.processing_status,
                "processingMessage": doc.processing_message
            }
            for doc in documents
        ]
        db.close()
        return result
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/summary")
async def get_document_summary_by_id(document_id: int):
    """Temporary placeholder for document summary by id. Returns empty or text_content snippet; AI extraction will be used later."""
    db = get_db_session()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            db.close()
            raise HTTPException(status_code=404, detail="Document not found")
        summary = ""
        if doc.text_content:
            summary = (doc.text_content[:500] + "..." if len(doc.text_content) > 500 else doc.text_content)
        db.close()
        return {"summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/preview")
async def get_document_preview_by_id(document_id: int):
    """Generate document preview by document id (uses file_path). Returns PDF with X-Preview-Version. Uses cache when source file unchanged."""
    db = get_db_session()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            db.close()
            raise HTTPException(status_code=404, detail="Document not found")
        full_path = (doc.file_path or "").strip()
        if not full_path or not os.path.isfile(full_path):
            db.close()
            raise HTTPException(status_code=404, detail="File not found")
        version = _file_version(full_path)
        ext = (os.path.splitext(full_path)[1] or "").lstrip(".").lower()
        if ext == "jpeg":
            ext = "jpg"
        if ext == "pdf":
            with open(full_path, "rb") as f:
                data = f.read()
            db.close()
            return Response(content=data, media_type="application/pdf", headers={"X-Preview-Version": version})
        if not is_office_extension(ext):
            db.close()
            raise HTTPException(status_code=400, detail="Preview not supported for this file type")
        cache_key = "doc_{}".format(document_id)
        cache_path = _preview_cache_path(cache_key, version)
        if os.path.isfile(cache_path):
            with open(cache_path, "rb") as f:
                data = f.read()
            db.close()
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
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/knowledge-points")
async def list_knowledge_points(
    page: int = 1,
    page_size: int = 50,
    document_id: Optional[int] = Query(None),
    min_weight: Optional[float] = Query(None, description="Min weight 1-5, filter points with weight >= this value"),
):
    """List knowledge points with pagination. Filter by document_id and/or min_weight when provided."""
    db = None
    try:
        db = get_db_session()
        query = db.query(KnowledgePoint, Document).join(Document, KnowledgePoint.document_id == Document.id)
        
        if document_id is not None:
            query = query.filter(KnowledgePoint.document_id == document_id)
        if min_weight is not None:
            w = float(min_weight)
            query = query.filter(KnowledgePoint.weight >= w)
        query = query.filter(KnowledgePoint.excluded == False)
            
        total = query.count()
        points = query.order_by(KnowledgePoint.document_id, KnowledgePoint.chunk_index)\
                      .offset((page - 1) * page_size)\
                      .limit(page_size)\
                      .all()
        
        result = []
        import json
        for kp, doc in points:
            if kp.content:
                keywords_list = []
                if getattr(kp, "keywords", None):
                    try:
                        keywords_list = json.loads(kp.keywords)
                        if not isinstance(keywords_list, list):
                            keywords_list = []
                    except:
                        keywords_list = []
                result.append({
                    "id": kp.id,
                    "content": kp.content,
                    "document_id": doc.id,
                    "document_name": doc.filename,
                    "chunk_index": kp.chunk_index,
                    "weight": getattr(kp, "weight", 1.0),
                    "excluded": bool(getattr(kp, "excluded", False)),
                    "is_manual": bool(getattr(kp, "is_manual", False)),
                    "keywords": keywords_list
                })
                
        db.close()
        return {
            "knowledge_points": result,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/knowledge-points")
async def create_manual_knowledge_point(body: Dict[str, Any] = Body(...)):
    """Create a manual (user-added) knowledge point for a document."""
    document_id = body.get("document_id")
    content = (body.get("content") or "").strip()
    if document_id is None:
        raise HTTPException(status_code=400, detail="document_id is required")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    db = None
    try:
        db = get_db_session()
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            db.close()
            raise HTTPException(status_code=404, detail="Document not found")
        from sqlalchemy import func
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
            is_manual=True
        )
        db.add(kp)
        db.commit()
        db.refresh(kp)
        import json
        keywords_list = []
        if getattr(kp, "keywords", None):
            try:
                keywords_list = json.loads(kp.keywords)
                if not isinstance(keywords_list, list):
                    keywords_list = []
            except:
                keywords_list = []
        out = {
            "id": kp.id,
            "content": kp.content,
            "document_id": kp.document_id,
            "document_name": doc.filename,
            "chunk_index": kp.chunk_index,
            "weight": getattr(kp, "weight", 1.0),
            "excluded": bool(getattr(kp, "excluded", False)),
            "is_manual": True,
            "keywords": keywords_list
        }
        db.close()
        return out
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/knowledge-points/batch")
async def delete_knowledge_points_batch(body: Dict[str, Any] = Body(...)):
    """Batch delete knowledge points by ids. Removes from DB and vector store."""
    ids = body.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids must be a non-empty list")
    db = None
    try:
        db = get_db_session()
        points = db.query(KnowledgePoint).filter(KnowledgePoint.id.in_(ids)).all()
        if not points:
            db.close()
            return {"deleted": 0, "message": "No matching knowledge points"}
        doc_chunks = {}
        for kp in points:
            doc_id = kp.document_id
            if doc_id not in doc_chunks:
                doc_chunks[doc_id] = []
            doc_chunks[doc_id].append(kp.chunk_index)
            db.delete(kp)
        db.commit()
        db.close()
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
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/documents/knowledge-points/{kp_id}")
async def update_knowledge_point_weight(kp_id: int, body: Dict[str, Any] = Body(...)):
    """Update knowledge point weight."""
    weight = body.get("weight")
    if weight is None or not isinstance(weight, (int, float)):
        raise HTTPException(status_code=400, detail="weight must be a number")
    weight = float(weight)
    if weight < 1 or weight > 5:
        raise HTTPException(status_code=400, detail="weight must be between 1 and 5 (star rating)")
    db = None
    try:
        db = get_db_session()
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            db.close()
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        kp.weight = weight
        db.commit()
        db.close()
        return {"id": kp_id, "weight": weight}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/documents/knowledge-points/{kp_id}/excluded")
async def update_knowledge_point_excluded(kp_id: int, body: Dict[str, Any] = Body(...)):
    """Update knowledge point excluded (soft delete) state."""
    excluded = body.get("excluded")
    if excluded is None or not isinstance(excluded, bool):
        raise HTTPException(status_code=400, detail="excluded must be a boolean")
    db = None
    try:
        db = get_db_session()
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            db.close()
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        kp.excluded = excluded
        db.commit()
        db.close()
        return {"id": kp_id, "excluded": excluded}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/knowledge-points/{kp_id}/keywords")
async def add_knowledge_point_keyword(kp_id: int, body: Dict[str, Any] = Body(...)):
    """Add a keyword to a knowledge point."""
    keyword = body.get("keyword", "").strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    db = None
    try:
        import json
        db = get_db_session()
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            db.close()
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        
        keywords_list = []
        if kp.keywords:
            try:
                keywords_list = json.loads(kp.keywords)
                if not isinstance(keywords_list, list):
                    keywords_list = []
            except:
                keywords_list = []
        
        if keyword not in keywords_list:
            keywords_list.append(keyword)
            kp.keywords = json.dumps(keywords_list, ensure_ascii=False)
            db.commit()
        
        db.close()
        return {"id": kp_id, "keywords": keywords_list}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/knowledge-points/{kp_id}/keywords")
async def remove_knowledge_point_keyword(kp_id: int, body: Dict[str, Any] = Body(...)):
    """Remove a keyword from a knowledge point."""
    keyword = body.get("keyword", "").strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    db = None
    try:
        import json
        db = get_db_session()
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            db.close()
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        
        keywords_list = []
        if kp.keywords:
            try:
                keywords_list = json.loads(kp.keywords)
                if not isinstance(keywords_list, list):
                    keywords_list = []
            except:
                keywords_list = []
        
        if keyword in keywords_list:
            keywords_list.remove(keyword)
            kp.keywords = json.dumps(keywords_list, ensure_ascii=False) if keywords_list else None
            db.commit()
        
        db.close()
        return {"id": kp_id, "keywords": keywords_list}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/knowledge-points/{kp_id}/keywords")
async def get_knowledge_point_keywords(kp_id: int):
    """Get keywords for a knowledge point."""
    db = None
    try:
        import json
        db = get_db_session()
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_id).first()
        if not kp:
            db.close()
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        
        keywords_list = []
        if kp.keywords:
            try:
                keywords_list = json.loads(kp.keywords)
                if not isinstance(keywords_list, list):
                    keywords_list = []
            except:
                keywords_list = []
        
        db.close()
        return {"id": kp_id, "keywords": keywords_list}
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    """Delete a document and its associated data"""
    db = None
    try:
        db = get_db_session()
        doc = db.query(Document).filter(Document.id == document_id).first()
        
        if not doc:
            db.close()
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = doc.file_path
        
        # Delete associated knowledge points first (due to foreign key constraints)
        knowledge_points = db.query(KnowledgePoint).filter(KnowledgePoint.document_id == document_id).all()
        for kp in knowledge_points:
            db.delete(kp)
        
        # Delete associated annotations
        annotations = db.query(AnnotationModel).filter(AnnotationModel.document_id == document_id).all()
        for ann in annotations:
            db.delete(ann)
        
        # Delete from vector store before deleting document
        try:
            from services.rag_service import RAGService
            rag = RAGService()
            if rag.client:
                # Delete from document-specific collection
                collection_name = f"doc_{document_id}"
                try:
                    rag.client.delete_collection(collection_name)
                except Exception as e:
                    logger.warning(f"Failed to delete vector store collection {collection_name}: {e}")
                # Delete from global knowledge base collection
                try:
                    rag.delete_document(str(document_id), "global_knowledge_base")
                except Exception as e:
                    logger.warning(f"Failed to delete document from global vector store: {e}")
        except Exception as e:
            logger.warning(f"Failed to delete vector store data: {e}")
        
        # Delete the document
        db.delete(doc)
        db.commit()
        db.close()
        
        # Delete the document file and any related files (after successful DB deletion)
        if file_path:
            file_path = file_path.strip()
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted document file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete file {file_path}: {e}")
            # Also try to delete original file if it was converted to PDF
            # Check for files with same base name but different extensions
            if file_path:
                try:
                    file_dir = os.path.dirname(file_path)
                    file_base = os.path.splitext(os.path.basename(file_path))[0]
                    if file_dir and file_base:
                        # Common office extensions that might have been converted
                        original_extensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.ods', '.odp']
                        for ext in original_extensions:
                            original_path = os.path.join(file_dir, file_base + ext)
                            if os.path.exists(original_path) and os.path.abspath(original_path) != os.path.abspath(file_path):
                                try:
                                    os.remove(original_path)
                                    logger.info(f"Deleted original file: {original_path}")
                                except Exception as e:
                                    logger.warning(f"Failed to delete original file {original_path}: {e}")
                except Exception as e:
                    logger.warning(f"Failed to check for original files: {e}")
        
        return {"success": True, "message": "Document deleted successfully"}
    except HTTPException:
        if db:
            db.close()
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@router.post("/annotations/generate")
async def generate_annotations(body: Dict[str, Any] = Body(...)):
    """Generate instruction pairs from knowledge points"""
    from services.annotation_service import AnnotationService
    import re
    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        import json as json_module
        try:
            knowledge_points = json_module.loads(knowledge_points)
        except Exception as parse_err:
            logger.warning("annotations/generate: knowledge_points parse failed: %s", parse_err)
            knowledge_points = []
    api_key = body.get("api_key", "").strip() or ""
    platform = body.get("platform", "").strip().lower()
    model = body.get("model", "deepseek-chat")
    base_url = body.get("base_url")
    candidate_count = body.get("candidate_count", 1)
    try:
        candidate_count = int(candidate_count)
    except Exception:
        candidate_count = 1
    candidate_count = max(1, min(10, candidate_count))

    if not api_key and platform:
        api_key = _resolve_api_key(platform)

    logger.info(
        "annotations/generate: request received, knowledge_points_count=%d, candidate_count=%d, model=%s, api_key_set=%s",
        len(knowledge_points), candidate_count, model, bool(api_key),
    )

    service = AnnotationService(api_key=api_key if api_key else None, model=model, base_url=base_url)

    annotations = []
    errors = []
    seen_pairs = set()

    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    for i, kp in enumerate(knowledge_points):
        candidate_result = service.generate_instruction_candidates(kp, candidate_count)
        kp_annotations = candidate_result.get("annotations", [])
        kp_errors = candidate_result.get("errors", [])

        for ann in kp_annotations:
            instruction = (ann.get("instruction") or "").strip()
            response = (ann.get("response") or "").strip()
            if not instruction or not response:
                continue
            dedupe_key = f"{_normalize_text(instruction)}|||{_normalize_text(response)}"
            if dedupe_key in seen_pairs:
                continue
            seen_pairs.add(dedupe_key)
            annotations.append({
                "instruction": instruction,
                "response": response
            })

        for err_msg in kp_errors:
            if err_msg:
                errors.append(err_msg)
                logger.warning("annotations/generate: kp[%d] failed: %s", i, err_msg)

    logger.info("annotations/generate: done, annotations_count=%d", len(annotations))
    result = {"annotations": annotations}
    if not annotations and errors:
        first_err = errors[0] if errors else ""
        if "402" in first_err or "Insufficient Balance" in first_err:
            result["error"] = "Insufficient Balance (402). Please top up your DeepSeek account."
        else:
            result["error"] = first_err[:200] if len(first_err) > 200 else first_err
    return result

@router.post("/finetuning/estimate")
async def estimate_cost(request: Dict[str, Any]):
    """Estimate fine-tuning cost"""
    from services.finetuning_service import FineTuningService
    dataset_size = request.get("dataset_size", 0)
    model = request.get("model", "")
    platform = request.get("platform", "")
    service = FineTuningService()
    return service.estimate_cost(dataset_size, model, platform)

@router.post("/finetuning/submit")
async def submit_finetuning_job(body: Dict[str, Any] = Body(...)):
    """Submit fine-tuning job"""
    from services.finetuning_service import FineTuningService
    training_data = body.get("training_data", {})
    platform = body.get("platform", "").strip().lower()
    model = body.get("model", "")
    api_key = body.get("api_key", "").strip() or ""
    if not api_key and platform:
        api_key = _resolve_api_key(platform)
    annotations = training_data.get("annotations", [])
    format_type = training_data.get("format_type", "sft")
    if not isinstance(annotations, list):
        annotations = []

    # Server-side guard: tuned data cannot be re-submitted.
    db = get_db_session()
    try:
        submitted_ids: List[int] = []
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            ann_id = ann.get("id")
            if ann_id is None:
                continue
            try:
                ann_id_int = int(ann_id)
            except Exception:
                continue
            if ann_id_int > 0:
                submitted_ids.append(ann_id_int)
        if submitted_ids:
            submitted_ids = list(dict.fromkeys(submitted_ids))

        tuned_ids: set[int] = set()
        if submitted_ids:
            tuned_rows = db.query(TrainingAnnotationFinetuningLink.training_annotation_id).filter(
                TrainingAnnotationFinetuningLink.training_annotation_id.in_(submitted_ids)
            ).all()
            tuned_ids = {int(row[0]) for row in tuned_rows}

        tuned_pairs: set[tuple[str, str]] = set()
        tuned_pair_rows = (
            db.query(TrainingAnnotation.instruction, TrainingAnnotation.response)
            .join(
                TrainingAnnotationFinetuningLink,
                TrainingAnnotation.id == TrainingAnnotationFinetuningLink.training_annotation_id
            )
            .all()
        )
        for instruction_text, response_text in tuned_pair_rows:
            tuned_pairs.add((
                _normalize_annotation_text(instruction_text),
                _normalize_annotation_text(response_text)
            ))

        filtered_annotations: List[Dict[str, Any]] = []
        filtered_annotation_ids: List[int] = []
        for ann in annotations:
            if not isinstance(ann, dict):
                continue

            instruction = ann.get("instruction", ann.get("question", ""))
            response = ann.get("response", ann.get("answer", ""))
            norm_pair = (
                _normalize_annotation_text(instruction),
                _normalize_annotation_text(response)
            )
            if not norm_pair[0] or not norm_pair[1]:
                continue

            ann_id = ann.get("id")
            ann_id_int = None
            if ann_id is not None:
                try:
                    ann_id_int = int(ann_id)
                except Exception:
                    ann_id_int = None

            if ann_id_int is not None and ann_id_int in tuned_ids:
                continue
            if norm_pair in tuned_pairs:
                continue

            filtered_annotations.append(ann)
            if ann_id_int is not None and ann_id_int > 0:
                filtered_annotation_ids.append(ann_id_int)
    finally:
        db.close()

    if not filtered_annotations:
        raise HTTPException(status_code=400, detail="No untuned annotations available for submission")

    logger.info(
        "finetuning/submit: input platform=%s, model=%s, format_type=%s, annotations_count=%d, api_key_set=%s",
        platform, model, format_type, len(filtered_annotations), bool(api_key),
    )
    if filtered_annotations:
        first = filtered_annotations[0]
        instr = first.get("instruction", first.get("question", ""))[:80] if isinstance(first, dict) else ""
        logger.info("finetuning/submit: first_instruction_preview=%r", instr + ("..." if len(str(instr)) > 80 else ""))

    service = FineTuningService()

    # Prepare training data
    formatted_data = service.prepare_training_data(filtered_annotations, format_type)
    logger.info("finetuning/submit: prepared_data_len=%d chars", len(formatted_data))

    # Save to temp file using UTF-8 to avoid Windows default codec issues (e.g. gbk)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n', delete=False, suffix='.jsonl') as tmp_file:
        tmp_file.write(formatted_data)
        tmp_path = tmp_file.name

    try:
        job_info = service.submit_finetuning_job(
            tmp_path,
            model,
            platform,
            api_key
        )
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass

    logger.info(
        "finetuning/submit: output job_id=%s, status=%s",
        job_info.get("job_id", ""), job_info.get("status", ""),
    )

    annotation_ids = list(dict.fromkeys([x for x in filtered_annotation_ids if x > 0]))

    # Save to database and persist annotation-job relations
    db = get_db_session()
    try:
        job_db = FinetuningJob(
            job_id=job_info["job_id"],
            platform=platform,
            model=model,
            status=job_info["status"],
            progress=0.0
        )
        db.add(job_db)
        db.flush()

        if annotation_ids:
            existing_rows = db.query(TrainingAnnotation.id).filter(
                TrainingAnnotation.id.in_(annotation_ids)
            ).all()
            existing_ids = {row[0] for row in existing_rows}
            for ann_id in annotation_ids:
                if ann_id not in existing_ids:
                    continue
                link = TrainingAnnotationFinetuningLink(
                    training_annotation_id=ann_id,
                    finetuning_job_id=job_info["job_id"]
                )
                db.add(link)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

    out = dict(job_info)
    out["id"] = job_info.get("job_id", "")
    return out

@router.get("/finetuning/jobs")
async def list_finetuning_jobs():
    """List all fine-tuning jobs"""
    db = None
    try:
        from services.monitoring_service import MonitoringService
        monitor = MonitoringService()
        db = get_db_session()
        jobs = db.query(FinetuningJob).all()
        changed = False
        for job in jobs:
            changed = _sync_placeholder_finetuning_job_state(db, job, monitor) or changed
        if changed:
            db.commit()

        result = [
            {
                "id": job.job_id,
                "platform": job.platform,
                "model": job.model,
                "status": job.status,
                "progress": job.progress,
                "costUsd": job.cost_usd,
                "createdAt": job.created_at.isoformat() if job.created_at else None
            }
            for job in jobs
        ]
        db.close()
        return result
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/finetuning/jobs/{job_id}/logs")
async def get_job_logs(job_id: str, limit: int = 100):
    """Get logs for a specific job"""
    from services.monitoring_service import MonitoringService
    service = MonitoringService()
    return service.get_job_logs(job_id, limit)

@router.get("/finetuning/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get detailed status for a job"""
    from services.monitoring_service import MonitoringService
    service = MonitoringService()
    
    db = None
    try:
        db = get_db_session()
        job = db.query(FinetuningJob).filter(FinetuningJob.job_id == job_id).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        changed = _sync_placeholder_finetuning_job_state(db, job, service)
        if changed:
            db.commit()

        normalized_progress = _normalize_progress_for_monitor(job.progress)
        estimated_time = service.estimate_remaining_time(job_id, normalized_progress)
        cost_tracking = service.get_cost_tracking(job_id)
        
        result = {
            "job_id": job.job_id,
            "status": job.status,
            "progress": job.progress,
            "estimated_time_remaining": estimated_time,
            "cost_tracking": cost_tracking
        }
        
        db.close()
        return result
    except HTTPException:
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/desensitize")
async def desensitize_text(request: Dict[str, Any]):
    """Desensitize sensitive information in text"""
    from services.desensitization_service import DesensitizationService
    text = request.get("text", "")
    patterns = request.get("patterns")
    service = DesensitizationService()
    result = service.desensitize_text(text, patterns)
    try:
        with open(DESENSITIZATION_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps({"timestamp": datetime.utcnow().isoformat(), "result": result}, ensure_ascii=False) + "\n")
    except Exception:
        pass
    return result

# --- API Keys (Privacy Center) ---
@router.post("/api-keys")
async def save_api_key(request: Dict[str, Any]):
    """Save API key (encrypted) for a platform"""
    platform = request.get("platform", "").strip().lower()
    api_key = request.get("api_key", "").strip()
    if not platform or not api_key:
        raise HTTPException(status_code=400, detail="platform and api_key required")
    from services.security_service import SecurityService
    key_file = os.path.join(BACKEND_DIR, ".encryption_key")
    audit_path = AUDIT_LOG_PATH
    security = SecurityService(key_file=key_file)
    encrypted = security.encrypt_api_key(api_key)
    db = get_db_session()
    try:
        existing = db.query(APIKey).filter(APIKey.platform == platform).first()
        if existing:
            existing.encrypted_key = encrypted
        else:
            db.add(APIKey(platform=platform, encrypted_key=encrypted))
        db.commit()
        security.log_audit_event("api_key_save", {"platform": platform}, audit_path)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("/api-keys")
async def list_api_keys():
    """List stored API key platforms (no actual keys returned)"""
    db = get_db_session()
    try:
        keys = db.query(APIKey).all()
        return [{"platform": k.platform, "encrypted": True} for k in keys]
    finally:
        db.close()


def _resolve_api_key(platform: str) -> str:
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


def _serialize_training_item(item: TrainingItem) -> Dict[str, Any]:
    knowledge_point_keys = []
    if item.knowledge_point_keys:
        try:
            parsed = json.loads(item.knowledge_point_keys)
            if isinstance(parsed, list):
                knowledge_point_keys = [str(v) for v in parsed if isinstance(v, str) and v.strip()]
        except Exception:
            knowledge_point_keys = []
    return {
        "id": item.id,
        "name": item.name or "",
        "knowledge_point_keys": knowledge_point_keys,
        "prompt_template": item.prompt_template or "",
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _normalize_progress_for_monitor(progress: Any) -> float:
    try:
        p = float(progress or 0.0)
    except Exception:
        p = 0.0
    if p > 1.0:
        p = p / 100.0
    if p < 0.0:
        p = 0.0
    if p > 1.0:
        p = 1.0
    return p


def _normalize_annotation_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _is_placeholder_finetuning_job(job: FinetuningJob) -> bool:
    jid = (job.job_id or "").strip()
    if not jid:
        return False
    # Current finetuning service returns local placeholder job ids.
    return "_privatetune_job_" in jid


def _sync_placeholder_finetuning_job_state(db: Session, job: FinetuningJob, monitor_service: Any) -> bool:
    if not _is_placeholder_finetuning_job(job):
        return False
    if (job.status or "").lower() in ("completed", "failed", "cancelled"):
        return False

    now = datetime.utcnow()
    created_at = job.created_at or now
    elapsed = max(0.0, (now - created_at).total_seconds())

    warmup_seconds = 8.0
    complete_seconds = 180.0

    if elapsed < warmup_seconds:
        next_status = "submitted"
        next_progress = 0.0
    elif elapsed < complete_seconds:
        ratio = (elapsed - warmup_seconds) / max(1.0, (complete_seconds - warmup_seconds))
        next_status = "running"
        next_progress = max(1.0, min(95.0, ratio * 95.0))
    else:
        next_status = "completed"
        next_progress = 100.0

    cur_status = (job.status or "").lower()
    cur_progress = float(job.progress or 0.0)
    changed = (cur_status != next_status) or (abs(cur_progress - next_progress) >= 1.0)
    if not changed:
        return False

    job.status = next_status
    job.progress = round(next_progress, 2)
    if next_status == "completed":
        if not job.completed_at:
            job.completed_at = now
        if job.cost_usd is None:
            job.cost_usd = 0.0

    try:
        monitor_service.log_job_progress(
            job.job_id,
            _normalize_progress_for_monitor(job.progress),
            job.status,
            {"source": "placeholder_simulator"}
        )
    except Exception:
        pass

    return True


def _collect_training_annotation_link_info(db: Session, annotation_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not annotation_ids:
        return {}
    rows = (
        db.query(TrainingAnnotationFinetuningLink, FinetuningJob)
        .outerjoin(FinetuningJob, TrainingAnnotationFinetuningLink.finetuning_job_id == FinetuningJob.job_id)
        .filter(TrainingAnnotationFinetuningLink.training_annotation_id.in_(annotation_ids))
        .order_by(
            TrainingAnnotationFinetuningLink.training_annotation_id.asc(),
            TrainingAnnotationFinetuningLink.used_at.desc(),
            TrainingAnnotationFinetuningLink.id.desc(),
        )
        .all()
    )
    by_annotation: Dict[int, List[Dict[str, Any]]] = {}
    for link, job in rows:
        by_annotation.setdefault(link.training_annotation_id, []).append({
            "job_id": link.finetuning_job_id,
            "used_at": link.used_at.isoformat() if link.used_at else None,
            "job_status": job.status if job else None,
            "job_platform": job.platform if job else None,
            "job_model": job.model if job else None,
            "job_created_at": job.created_at.isoformat() if job and job.created_at else None,
        })
    return by_annotation


def _serialize_training_annotation(
    row: TrainingAnnotation,
    links: List[Dict[str, Any]]
) -> Dict[str, Any]:
    linked_jobs = links or []
    return {
        "id": row.id,
        "instruction": row.instruction,
        "response": row.response,
        "score": row.score,
        "training_item_id": row.training_item_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "finetuned": len(linked_jobs) > 0,
        "finetuned_count": len(linked_jobs),
        "linked_jobs": linked_jobs,
    }


@router.get("/training-items")
async def list_training_items():
    """List persisted training items."""
    db = get_db_session()
    try:
        items = db.query(TrainingItem).order_by(TrainingItem.updated_at.desc(), TrainingItem.id.desc()).all()
        return {"items": [_serialize_training_item(item) for item in items]}
    finally:
        db.close()


@router.post("/training-items")
async def save_training_item(body: Dict[str, Any] = Body(...)):
    """Create or update training item by unique name."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    keys = body.get("knowledge_point_keys", [])
    if isinstance(keys, str):
        try:
            keys = json.loads(keys)
        except Exception:
            keys = []
    if not isinstance(keys, list):
        keys = []
    knowledge_point_keys = [str(v).strip() for v in keys if str(v).strip()]

    prompt_template = (body.get("prompt_template") or "").strip()
    if not prompt_template:
        raise HTTPException(status_code=400, detail="prompt_template is required")

    db = get_db_session()
    try:
        existing = db.query(TrainingItem).filter(TrainingItem.name == name).first()
        if existing:
            existing.knowledge_point_keys = json.dumps(knowledge_point_keys, ensure_ascii=False)
            existing.prompt_template = prompt_template
            db.commit()
            db.refresh(existing)
            return _serialize_training_item(existing)

        item = TrainingItem(
            name=name,
            knowledge_point_keys=json.dumps(knowledge_point_keys, ensure_ascii=False),
            prompt_template=prompt_template,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return _serialize_training_item(item)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.delete("/training-items/{item_id}")
async def delete_training_item(item_id: int):
    """Delete a training item by id."""
    db = get_db_session()
    try:
        item = db.query(TrainingItem).filter(TrainingItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Training item not found")
        db.delete(item)
        db.commit()
        return {"success": True, "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# --- Training set (for Production Tuning) ---
@router.post("/training-set")
async def save_training_set(request: Dict[str, Any]):
    """Save current annotations for fine-tuning into database."""
    annotations = request.get("annotations", [])
    training_item_id = request.get("training_item_id")
    if training_item_id is not None:
        try:
            training_item_id = int(training_item_id)
        except Exception:
            raise HTTPException(status_code=400, detail="training_item_id must be integer")

    db = get_db_session()
    try:
        if training_item_id is not None:
            item = db.query(TrainingItem).filter(TrainingItem.id == training_item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail="Training item not found")

        saved_count = 0
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            instruction = (ann.get("instruction") or "").strip()
            response = (ann.get("response") or "").strip()
            if not instruction or not response:
                continue

            score_val = ann.get("score")
            score = None
            if score_val is not None and str(score_val).strip() != "":
                try:
                    score = int(score_val)
                except Exception:
                    score = None

            db.add(TrainingAnnotation(
                training_item_id=training_item_id,
                instruction=instruction,
                response=response,
                score=score
            ))
            saved_count += 1

        db.commit()
        return {"success": True, "count": saved_count}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("/training-set")
async def get_training_set(training_item_id: Optional[int] = Query(None)):
    """Get saved training set from database, optionally by training item."""
    db = get_db_session()
    try:
        if training_item_id is None:
            existing_count = db.query(TrainingAnnotation).count()
            if existing_count == 0 and os.path.exists(TRAINING_SET_PATH):
                try:
                    with open(TRAINING_SET_PATH, "r", encoding="utf-8") as f:
                        legacy_data = json.load(f)
                    legacy_annotations = legacy_data.get("annotations", []) if isinstance(legacy_data, dict) else []
                    for ann in legacy_annotations:
                        if not isinstance(ann, dict):
                            continue
                        instruction = (ann.get("instruction") or "").strip()
                        response = (ann.get("response") or "").strip()
                        if not instruction or not response:
                            continue
                        score_val = ann.get("score")
                        score = None
                        if score_val is not None and str(score_val).strip() != "":
                            try:
                                score = int(score_val)
                            except Exception:
                                score = None
                        db.add(TrainingAnnotation(
                            training_item_id=None,
                            instruction=instruction,
                            response=response,
                            score=score
                        ))
                    db.commit()
                except Exception:
                    db.rollback()

        query = db.query(TrainingAnnotation)
        if training_item_id is not None:
            query = query.filter(TrainingAnnotation.training_item_id == training_item_id)

        rows = query.order_by(TrainingAnnotation.created_at.desc(), TrainingAnnotation.id.desc()).all()
        row_ids = [row.id for row in rows if row.id is not None]
        link_map = _collect_training_annotation_link_info(db, row_ids)
        annotations = [
            _serialize_training_annotation(row, link_map.get(row.id, []))
            for row in rows
        ]
        return {"annotations": annotations, "count": len(annotations)}
    finally:
        db.close()

# --- Audit log & Desensitization log ---
@router.get("/audit-log")
async def get_audit_log(limit: int = 200):
    """Get recent audit log entries"""
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
    """Get recent desensitization log entries"""
    import json
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

# --- Evaluation (generate & compare) ---
@router.post("/evaluation/generate")
async def evaluation_generate(body: Dict[str, Any] = Body(...)):
    """Generate content for evaluation (before/after comparison)"""
    from services.evaluation_service import EvaluationService
    prompt = body.get("prompt", "").strip()
    template_name = body.get("template", "custom")
    model_endpoint = body.get("model_endpoint")
    api_key = (body.get("api_key") or "").strip() or ""
    platform = (body.get("platform") or "").strip().lower()
    if not api_key and platform:
        api_key = _resolve_api_key(platform)
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt required")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="The api_key client option must be set either by passing api_key to the client or by setting the OPENAI_API_KEY environment variable",
        )
    service = EvaluationService(api_key=api_key)
    template_text = service.get_template(template_name) if hasattr(service, "get_template") else ""
    if not template_text:
        template_text = (
            "# Output format (Markdown)\n\n"
            "Generate professional content. **Output in Markdown.** Use headings (##) and paragraphs as appropriate.\n\n"
            "## User request\n\n{prompt}\n\n---\nOutput the full content in Markdown. Use the same language as the user request."
        )
    context = {
        "prompt": prompt,
        "title": prompt,
        "client": prompt,
        "objective": prompt,
        "scope": prompt,
        "timeline": prompt,
        "budget": prompt,
        "project_name": prompt,
        "requirements": prompt,
        "tech_stack": prompt,
        "architecture": prompt,
        "abstract": prompt,
        "keywords": prompt,
        "introduction": prompt,
        "methodology": prompt,
        "results": prompt,
        "discussion": prompt,
    }
    result = service.generate_content(template_text, context, model_endpoint, api_key)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.get("/models/local")
async def list_local_models(base_url: str = "http://localhost:11434"):
    """List available local models from Ollama"""
    import requests
    try:
        # Clean up base_url to ensure it doesn't end with /v1 if we are hitting /api/tags
        # Ollama standard API is at /api/tags. OpenAI compatible is /v1/models
        # Let's try /api/tags first as it gives more info usually, or /v1/models
        
        target_url = base_url.rstrip("/")
        if target_url.endswith("/v1"):
            target_url = target_url[:-3]
            
        # Try /api/tags (Ollama native)
        try:
            resp = requests.get(f"{target_url}/api/tags", timeout=2)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                return {"models": [m["name"] for m in models]}
        except:
            pass
            
        # Try /v1/models (OpenAI compatible)
        try:
            resp = requests.get(f"{target_url}/v1/models", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                # OpenAI format: {"data": [{"id": "model-name", ...}]}
                return {"models": [m["id"] for m in data.get("data", [])]}
        except:
            pass
            
        return {"models": []}
    except Exception as e:
        logger.error(f"Failed to list local models: {e}")
        return {"models": [], "error": str(e)}

@router.post("/chat/query")
async def chat_query(body: Dict[str, Any] = Body(...)):
    """Chat with the knowledge base"""
    query = body.get("query", "")
    api_key = (body.get("api_key") or "").strip() or ""
    platform = (body.get("platform") or "").strip().lower()
    if not api_key and platform:
        api_key = _resolve_api_key(platform)
    model = body.get("model", "deepseek-chat")
    base_url = body.get("base_url")

    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    try:
        # 1. Search Knowledge Base
        from services.rag_service import RAGService
        rag = RAGService()
        
        # Search global collection
        search_results = rag.search_similar(query, n_results=5)
        
        context = ""
        if search_results:
            context = "\n\n".join([f"Document chunk {i+1}:\n{r['content']}" for i, r in enumerate(search_results)])
        else:
            context = "No specific documents found in knowledge base."

        # 2. Generate Answer
        from services.annotation_service import AnnotationService
        # Use provided api_key or fallback to None (service might use env var or default)
        service = AnnotationService(api_key=api_key if api_key else None, model=model, base_url=base_url)
        
        # Use generate_qa_pair logic but adapted for chat
        # generate_qa_pair takes (context, question) and returns {question, answer}
        # We can just use the answer part.
        
        result = service.generate_qa_pair(context=context, question=query)
        
        if "error" in result:
             # Fallback or error
             return {"answer": f"Error generating response: {result['error']}", "context": context}
             
        return {
            "answer": result.get("answer", "No answer generated."),
            "context": context, # Optional: return context for UI reference
            "sources": [r.get("metadata", {}) for r in search_results]
        }
    except Exception as e:
        logger.error(f"Chat query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
