"""
Document upload, list, summary, preview, delete and background processing.
"""
import os
import logging
import shutil
import tempfile
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import Response

from database.models import Document, KnowledgePoint
from api.db import get_db_session
from api.shared import get_random_storage_dir, file_version, preview_cache_path
from services.libreoffice_parser import is_office_extension, convert_to_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


def process_document_background(document_id: int, file_path: str, file_type: str):
    """Background task to process document. Non-PDF Office docs are converted to PDF first."""
    db = get_db_session()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

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

        doc.processing_status = "processing"
        doc.processing_message = "Extracting text..."
        db.commit()

        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        result = processor.process_document(file_path, file_type)

        if "error" in result:
            doc.processing_status = "failed"
            doc.processing_message = result.get("error", "Unknown error")
            db.commit()
            return

        cleaned_text = result.get("cleaned_text", "")
        if not cleaned_text or len(cleaned_text.strip()) == 0:
            doc.processing_status = "failed"
            doc.processing_message = "Empty content extracted"
            db.commit()
            return

        doc.text_content = cleaned_text
        doc.processing_message = "Generating knowledge points..."
        db.commit()

        from api.routers.config import get_rag_config_for_service
        from api.helpers import resolve_api_key as resolve_rag_api_key
        from api.shared import get_chroma_db_path
        from services.rag_service import RAGService
        rag_cfg = get_rag_config_for_service()
        emb_platform = (rag_cfg.get("embeddingPlatform") or "deepseek").strip().lower()
        rag_cfg["embeddingApiKey"] = resolve_rag_api_key(emb_platform)
        rag = RAGService(chroma_db_path=get_chroma_db_path(), rag_config=rag_cfg)
        knowledge_points = rag.structure_document(cleaned_text, str(doc.id))

        if knowledge_points and len(knowledge_points) > 0:
            rag.add_to_vector_store(knowledge_points, f"doc_{doc.id}")
            rag.add_to_vector_store(knowledge_points, "global_knowledge_base")

        kp_db_list = []
        for kp in knowledge_points:
            kp_db = KnowledgePoint(
                document_id=doc.id,
                content=kp["content"],
                chunk_index=kp["chunk_index"],
                tags="[]"
            )
            db.add(kp_db)
            kp_db_list.append(kp_db)

        doc.processed = True
        doc.processing_status = "completed"
        doc.processing_message = f"Processed successfully. {len(knowledge_points)} knowledge points generated."
        db.commit()

        try:
            from api.db import engine
            from services.fulltext_service import add_to_fts
            for kp_db in kp_db_list:
                add_to_fts(engine, doc.id, kp_db.id, kp_db.content)
        except Exception as fts_err:
            logger.warning("Failed to update full-text index for doc %s: %s", document_id, fts_err)

    except Exception as e:
        logger.error("Background processing failed for doc %s: %s", document_id, e)
        try:
            doc.processing_status = "failed"
            doc.processing_message = str(e)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/documents/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a document and start processing in background."""
    tmp_path = None
    db = None
    try:
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stored_filename = f"{timestamp}_{safe_filename}"
        storage_dir = get_random_storage_dir()
        tmp_path = os.path.join(storage_dir, stored_filename)

        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        file_type = os.path.splitext(file.filename)[1][1:].lower()

        db = get_db_session()
        try:
            doc = Document(
                filename=file.filename,
                file_path=tmp_path,
                file_type=file_type,
                processing_status="pending",
                processing_message="Waiting for processing...",
                processed=False
            )
            db.add(doc)
            db.commit()

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


@router.get("/documents")
async def list_documents():
    """List all documents with knowledge point counts via SQL JOIN."""
    db = None
    try:
        from sqlalchemy import func
        db = get_db_session()
        kp_subq = (
            db.query(
                KnowledgePoint.document_id,
                func.count(KnowledgePoint.id).label('kp_count')
            )
            .filter(KnowledgePoint.excluded == False)
            .group_by(KnowledgePoint.document_id)
            .subquery()
        )
        rows = (
            db.query(Document, func.coalesce(kp_subq.c.kp_count, 0))
            .outerjoin(kp_subq, Document.id == kp_subq.c.document_id)
            .all()
        )
        result = [
            {
                "id": doc.id,
                "filename": doc.filename,
                "fileType": doc.file_type,
                "uploadTime": doc.upload_time.isoformat() if doc.upload_time else None,
                "processed": doc.processed,
                "processingStatus": doc.processing_status,
                "processingMessage": doc.processing_message,
                "knowledgePointCount": kp_count
            }
            for doc, kp_count in rows
        ]
        db.close()
        return result
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/summary")
async def get_document_summary_by_id(document_id: int):
    """Placeholder for document summary by id. Returns text_content snippet."""
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
    """Generate document preview by document id. Returns PDF with X-Preview-Version. Uses cache when unchanged."""
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
        version = file_version(full_path)
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
        cache_path = preview_cache_path(cache_key, version)
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


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    """Delete a document and its associated data."""
    from database.models import Annotation as AnnotationModel
    db = None
    try:
        db = get_db_session()
        doc = db.query(Document).filter(Document.id == document_id).first()

        if not doc:
            db.close()
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = doc.file_path

        knowledge_points = db.query(KnowledgePoint).filter(KnowledgePoint.document_id == document_id).all()
        for kp in knowledge_points:
            db.delete(kp)

        annotations = db.query(AnnotationModel).filter(AnnotationModel.document_id == document_id).all()
        for ann in annotations:
            db.delete(ann)

        try:
            from api.routers.config import get_rag_config_for_service
            from api.helpers import resolve_api_key as resolve_rag_api_key
            from api.shared import get_chroma_db_path
            from services.rag_service import RAGService
            rag_cfg = get_rag_config_for_service()
            emb_platform = (rag_cfg.get("embeddingPlatform") or "deepseek").strip().lower()
            rag_cfg["embeddingApiKey"] = resolve_rag_api_key(emb_platform)
            rag = RAGService(chroma_db_path=get_chroma_db_path(), rag_config=rag_cfg)
            if rag.client:
                collection_name = f"doc_{document_id}"
                try:
                    rag.client.delete_collection(collection_name)
                except Exception as e:
                    logger.warning("Failed to delete vector store collection %s: %s", collection_name, e)
                try:
                    rag.delete_document(str(document_id), "global_knowledge_base")
                except Exception as e:
                    logger.warning("Failed to delete document from global vector store: %s", e)
        except Exception as e:
            logger.warning("Failed to delete vector store data: %s", e)

        try:
            from api.db import engine
            from services.fulltext_service import remove_document_from_fts
            remove_document_from_fts(engine, document_id)
        except Exception as e:
            logger.warning("Failed to remove document from full-text index: %s", e)

        db.delete(doc)
        db.commit()
        db.close()

        if file_path:
            file_path = file_path.strip()
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info("Deleted document file: %s", file_path)
                except Exception as e:
                    logger.warning("Failed to delete file %s: %s", file_path, e)
            if file_path:
                try:
                    file_dir = os.path.dirname(file_path)
                    file_base = os.path.splitext(os.path.basename(file_path))[0]
                    if file_dir and file_base:
                        original_extensions = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp"]
                        for ext in original_extensions:
                            original_path = os.path.join(file_dir, file_base + ext)
                            if os.path.exists(original_path) and os.path.abspath(original_path) != os.path.abspath(file_path):
                                try:
                                    os.remove(original_path)
                                    logger.info("Deleted original file: %s", original_path)
                                except Exception as e:
                                    logger.warning("Failed to delete original file %s: %s", original_path, e)
                except Exception as e:
                    logger.warning("Failed to check for original files: %s", e)

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
