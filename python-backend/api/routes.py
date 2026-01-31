"""
API Routes for Python Backend
FastAPI routes for document processing, annotation, and fine-tuning
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Body, BackgroundTasks
from typing import List, Dict, Any
import os
import json
import logging
import tempfile

logger = logging.getLogger(__name__)
from datetime import datetime
from database.models import Document, KnowledgePoint, Annotation as AnnotationModel, FinetuningJob, APIKey, Directory, init_database
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

router = APIRouter()

# Initialize database
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
db_path = os.path.join(BACKEND_DIR, "privatetune.db")
engine = init_database(db_path)

# Documents storage directory
DOCUMENTS_DIR = os.path.join(BACKEND_DIR, "documents")
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

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
    """Move document to a directory"""
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
        # Save uploaded file to documents directory
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stored_filename = f"{timestamp}_{safe_filename}"
        tmp_path = os.path.join(DOCUMENTS_DIR, stored_filename)
        
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
    """Background task to process document"""
    db = get_db_session()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return
            
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

@router.get("/documents/knowledge-points")
async def list_knowledge_points(page: int = 1, page_size: int = 50, document_id: int = None):
    """List knowledge points with pagination"""
    db = None
    try:
        db = get_db_session()
        query = db.query(KnowledgePoint, Document).join(Document, KnowledgePoint.document_id == Document.id)
        
        if document_id:
            query = query.filter(KnowledgePoint.document_id == document_id)
            
        total = query.count()
        points = query.order_by(KnowledgePoint.document_id, KnowledgePoint.chunk_index)\
                      .offset((page - 1) * page_size)\
                      .limit(page_size)\
                      .all()
        
        result = []
        for kp, doc in points:
            if kp.content:
                result.append({
                    "content": kp.content,
                    "document_id": doc.id,
                    "document_name": doc.filename,
                    "chunk_index": kp.chunk_index
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
                collection_name = f"doc_{document_id}"
                try:
                    rag.client.delete_collection(collection_name)
                except Exception as e:
                    print(f"Warning: Failed to delete vector store collection {collection_name}: {e}")
        except Exception as e:
            print(f"Warning: Failed to delete vector store collection: {e}")
        
        # Delete the document
        db.delete(doc)
        db.commit()
        db.close()
        
        # Delete the document file if it exists (after successful DB deletion)
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Failed to delete file {file_path}: {e}")
        
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
    knowledge_points = body.get("knowledge_points", [])
    if isinstance(knowledge_points, str):
        import json as json_module
        try:
            knowledge_points = json_module.loads(knowledge_points)
        except Exception as parse_err:
            logger.warning("annotations/generate: knowledge_points parse failed: %s", parse_err)
            knowledge_points = []
    api_key = body.get("api_key", "")
    model = body.get("model", "deepseek-chat")
    base_url = body.get("base_url")

    logger.info(
        "annotations/generate: request received, knowledge_points_count=%d, model=%s, api_key_set=%s",
        len(knowledge_points), model, bool(api_key),
    )

    service = AnnotationService(api_key=api_key, model=model, base_url=base_url)

    annotations = []
    errors = []
    for i, kp in enumerate(knowledge_points):
        annotation = service.generate_instruction_pair(kp)
        if "error" not in annotation:
            annotations.append(annotation)
        else:
            err_msg = annotation.get("error", "")
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
    platform = body.get("platform", "")
    model = body.get("model", "")
    api_key = body.get("api_key", "")
    annotations = training_data.get("annotations", [])
    format_type = training_data.get("format_type", "sft")

    logger.info(
        "finetuning/submit: input platform=%s, model=%s, format_type=%s, annotations_count=%d, api_key_set=%s",
        platform, model, format_type, len(annotations), bool(api_key),
    )
    if annotations:
        first = annotations[0]
        instr = first.get("instruction", first.get("question", ""))[:80] if isinstance(first, dict) else ""
        logger.info("finetuning/submit: first_instruction_preview=%r", instr + ("..." if len(str(instr)) > 80 else ""))

    service = FineTuningService()

    # Prepare training data
    formatted_data = service.prepare_training_data(annotations, format_type)
    logger.info("finetuning/submit: prepared_data_len=%d chars", len(formatted_data))

    # Save to temp file
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as tmp_file:
        tmp_file.write(formatted_data)
        tmp_path = tmp_file.name

    job_info = service.submit_finetuning_job(
        tmp_path,
        model,
        platform,
        api_key
    )

    logger.info(
        "finetuning/submit: output job_id=%s, status=%s",
        job_info.get("job_id", ""), job_info.get("status", ""),
    )

    # Save to database
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
        db = get_db_session()
        jobs = db.query(FinetuningJob).all()
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
        
        estimated_time = service.estimate_remaining_time(job_id, job.progress)
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

# --- Training set (for Production Tuning) ---
@router.post("/training-set")
async def save_training_set(request: Dict[str, Any]):
    """Save current annotations for fine-tuning"""
    annotations = request.get("annotations", [])
    import json
    data = {"annotations": annotations, "count": len(annotations), "updated_at": datetime.utcnow().isoformat()}
    with open(TRAINING_SET_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"success": True, "count": len(annotations)}

@router.get("/training-set")
async def get_training_set():
    """Get saved training set for fine-tuning"""
    import json
    if not os.path.exists(TRAINING_SET_PATH):
        return {"annotations": [], "count": 0}
    with open(TRAINING_SET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {"annotations": data.get("annotations", []), "count": data.get("count", 0)}

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
    api_key = body.get("api_key") or ""
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
    api_key = body.get("api_key", "")
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
