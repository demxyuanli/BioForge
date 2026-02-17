"""Chat with knowledge base routes."""
import logging
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from api.helpers import resolve_api_key

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat/query")
async def chat_query(body: Dict[str, Any] = Body(...)):
    """Chat with the knowledge base."""
    query = (body.get("query") or "").strip()
    api_key = (body.get("api_key") or "").strip() or ""
    platform = (body.get("platform") or "").strip().lower()
    if not api_key and platform:
        api_key = resolve_api_key(platform)
    model = body.get("model", "deepseek-chat")
    base_url = body.get("base_url")

    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    try:
        from api.routers.config import get_rag_config_for_service
        from api.helpers import resolve_api_key as resolve_rag_api_key
        from api.shared import get_chroma_db_path
        from services.rag_service import RAGService
        rag_cfg = get_rag_config_for_service()
        emb_platform = (rag_cfg.get("embeddingPlatform") or "deepseek").strip().lower()
        rag_cfg["embeddingApiKey"] = resolve_rag_api_key(emb_platform)
        n_context = int(rag_cfg.get("contextWindow") or 5)
        rag = RAGService(chroma_db_path=get_chroma_db_path(), rag_config=rag_cfg)
        search_results = rag.search_similar(query, n_results=n_context)
        context = ""
        if search_results:
            context = "\n\n".join([f"Document chunk {i+1}:\n{r['content']}" for i, r in enumerate(search_results)])
        else:
            context = "No specific documents found in knowledge base."

        from services.annotation_service import AnnotationService
        service = AnnotationService(api_key=api_key if api_key else None, model=model, base_url=base_url)
        result = service.generate_qa_pair(context=context, question=query)
        logger.info("chat/query result keys=%s answer_len=%s", list(result.keys()), len(result.get("answer") or ""))

        if "error" in result:
            return {
                "question": query,
                "answer": f"Error generating response: {result['error']}",
                "context": context,
                "sources": [r.get("metadata", {}) for r in search_results],
            }

        answer = result.get("answer") or "No answer generated."
        if not isinstance(answer, str):
            answer = str(answer)
        payload = {
            "question": result.get("question", query),
            "answer": answer,
            "context": context,
            "sources": [r.get("metadata", {}) for r in search_results],
        }
        logger.info("chat/query returning answer length=%s", len(payload["answer"]))
        return payload
    except Exception as e:
        logger.error("Chat query error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
