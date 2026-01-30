"""
API Routes for Python Backend
FastAPI routes for document processing, annotation, and fine-tuning
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict, Any
import os
import tempfile
from datetime import datetime
from database.models import Document, KnowledgePoint, Annotation as AnnotationModel, FinetuningJob, init_database
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

router = APIRouter()

# Initialize database
db_path = os.path.join(os.path.dirname(__file__), "..", "privatetune.db")
engine = init_database(db_path)

# Documents storage directory
DOCUMENTS_DIR = os.path.join(os.path.dirname(__file__), "..", "documents")
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

def get_db_session():
    return Session(engine)

@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a document"""
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
        
        # Process document
        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        file_type = os.path.splitext(file.filename)[1][1:].lower()
        result = processor.process_document(tmp_path, file_type)
        
        # Check if processing was successful
        if "error" in result:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass
            raise HTTPException(status_code=400, detail=f"Document processing failed: {result.get('error', 'Unknown error')}")
        
        # Validate that we have text content
        cleaned_text = result.get("cleaned_text", "")
        if not cleaned_text or len(cleaned_text.strip()) == 0:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass
            raise HTTPException(status_code=400, detail="Document processing resulted in empty content. The file may be corrupted or unsupported.")
        
        # Save to database
        db = get_db_session()
        try:
            doc = Document(
                filename=file.filename,
                file_path=tmp_path,
                file_type=file_type,
                text_content=cleaned_text,
                processed=True
            )
            db.add(doc)
            db.flush()  # Flush to get the ID without committing
            
            # Save knowledge points
            from services.rag_service import RAGService
            rag = RAGService()
            knowledge_points = rag.structure_document(cleaned_text, str(doc.id))
            
            # Only add to vector store if we have valid knowledge points
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
            
            db.commit()
            
            result["document_id"] = doc.id
            result["knowledge_points_count"] = len(knowledge_points)
            
            return result
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            # Clean up file if database save failed
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass
            raise HTTPException(status_code=500, detail=f"Failed to save document to database: {str(e)}")
        finally:
            if db:
                db.close()
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file on any error
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

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
                "processed": doc.processed
            }
            for doc in documents
        ]
        db.close()
        return result
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
async def generate_annotations(request: Dict[str, Any]):
    """Generate instruction pairs from knowledge points"""
    from services.annotation_service import AnnotationService
    knowledge_points = request.get("knowledge_points", [])
    api_key = request.get("api_key", "")
    model = request.get("model", "gpt-4")
    
    service = AnnotationService(api_key=api_key, model=model)
    
    annotations = []
    for kp in knowledge_points:
        annotation = service.generate_instruction_pair(kp)
        if "error" not in annotation:
            annotations.append(annotation)
    
    return {"annotations": annotations}

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
async def submit_finetuning_job(
    training_data: Dict[str, Any],
    platform: str,
    model: str,
    api_key: str
):
    """Submit fine-tuning job"""
    from services.finetuning_service import FineTuningService
    service = FineTuningService()
    
    # Prepare training data
    formatted_data = service.prepare_training_data(
        training_data.get("annotations", []),
        training_data.get("format_type", "sft")
    )
    
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
    
    return job_info

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
async def desensitize_text(text: str, patterns: List[str] = None):
    """Desensitize sensitive information in text"""
    from services.desensitization_service import DesensitizationService
    service = DesensitizationService()
    return service.desensitize_text(text, patterns)
