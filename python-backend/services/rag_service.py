"""
RAG Service
Handles document structuring, configurable embeddings, and hybrid (vector + BM25) retrieval.
"""
from typing import List, Dict, Any, Optional
import json
import os
import re

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None

try:
    import chromadb
    from chromadb.api.types import Documents, Embeddings
except ImportError:
    chromadb = None
    Documents = None
    Embeddings = None

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None


def _tokenize_for_bm25(text: str) -> List[str]:
    """Simple tokenizer: lowercase, split on non-alphanumeric."""
    return re.sub(r"[^a-zA-Z0-9\s]", " ", (text or "").lower()).split()


class OpenAICompatibleEmbeddingFunction:
    """Embedding function using OpenAI-compatible API (Ollama, OpenAI, etc.)."""

    def __init__(self, model: str, api_key: str = "", base_url: Optional[str] = None):
        self.model = model
        self.api_key = api_key or "ollama"
        self.base_url = (base_url or "").strip() or None

    def __call__(self, input: Documents) -> Embeddings:
        if not input:
            return []
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key, base_url=self.base_url)
            resp = client.embeddings.create(model=self.model, input=input)
            return [e.embedding for e in resp.data]
        except Exception as e:
            print(f"Embedding error: {e}")
            return []


class RAGService:
    def __init__(
        self,
        chroma_db_path: str = "./chroma_db",
        rag_config: Optional[Dict[str, Any]] = None,
    ):
        self.chroma_db_path = chroma_db_path
        self.rag_config = rag_config or {}
        self._chunk_size = int(self.rag_config.get("chunkSize") or 500)
        self._chunk_overlap = max(0, self._chunk_size // 5)
        self._use_hybrid = bool(self.rag_config.get("useHybrid", True))

        self._embedding_function = None
        emb_model = (self.rag_config.get("embeddingModel") or "").strip()
        if emb_model:
            emb_base = (self.rag_config.get("embeddingBaseUrl") or "").strip()
            emb_api_key = (self.rag_config.get("embeddingApiKey") or "").strip()
            self._embedding_function = OpenAICompatibleEmbeddingFunction(
                model=emb_model, api_key=emb_api_key, base_url=emb_base or None
            )

        if chromadb:
            os.makedirs(chroma_db_path, exist_ok=True)
            self.client = chromadb.PersistentClient(path=chroma_db_path)
        else:
            self.client = None

        if RecursiveCharacterTextSplitter:
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self._chunk_size,
                chunk_overlap=self._chunk_overlap,
            )
        else:
            self.text_splitter = None

    def _get_collection(self, collection_name: str):
        if not self.client:
            return None
        return self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self._embedding_function,
        )

    def _bm25_path(self, collection_name: str) -> str:
        safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in collection_name)
        return os.path.join(self.chroma_db_path, f"bm25_corpus_{safe}.json")

    def _load_bm25_corpus(self, collection_name: str) -> tuple:
        path = self._bm25_path(collection_name)
        if not os.path.exists(path):
            return [], []
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            ids = data.get("ids") or []
            documents = data.get("documents") or []
            return ids, documents
        except Exception:
            return [], []

    def _save_bm25_corpus(self, collection_name: str, ids: List[str], documents: List[str]) -> None:
        path = self._bm25_path(collection_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"ids": ids, "documents": documents}, f, ensure_ascii=False)

    def structure_document(self, text: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Structure long document into atomic knowledge points using RAG.
        Returns list of structured knowledge points.
        """
        if self.text_splitter:
            chunks = self.text_splitter.split_text(text)
        else:
            chunks = self._simple_split_text(
                text, chunk_size=self._chunk_size, overlap=self._chunk_overlap
            )

        knowledge_points = []
        for i, chunk in enumerate(chunks):
            knowledge_points.append({
                "id": f"{document_id}_chunk_{i}",
                "content": chunk,
                "chunk_index": i,
                "tags": [],
            })
        return knowledge_points

    def _simple_split_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        if len(text) <= chunk_size:
            return [text]
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            if end >= len(text):
                chunks.append(text[start:])
                break
            chunk = text[start:end]
            last_period = chunk.rfind(".")
            last_newline = chunk.rfind("\n")
            break_point = max(last_period, last_newline)
            if break_point > chunk_size * 0.5:
                end = start + break_point + 1
            chunks.append(text[start:end])
            start = end - overlap
        return chunks

    def add_to_vector_store(
        self,
        knowledge_points: List[Dict[str, Any]],
        collection_name: str = "global_knowledge_base",
    ) -> None:
        if not self.client:
            return
        try:
            collection = self._get_collection(collection_name)
            ids = [kp["id"] for kp in knowledge_points]
            documents = [kp["content"] for kp in knowledge_points]
            metadatas = []
            for kp in knowledge_points:
                doc_id_str = kp["id"].split("_chunk_")[0]
                metadatas.append({
                    "chunk_index": kp["chunk_index"],
                    "document_id": doc_id_str,
                })
            collection.add(ids=ids, documents=documents, metadatas=metadatas)

            if self._use_hybrid and BM25Okapi:
                bm25_ids, bm25_docs = self._load_bm25_corpus(collection_name)
                for kp in knowledge_points:
                    bm25_ids.append(kp["id"])
                    bm25_docs.append(kp["content"])
                self._save_bm25_corpus(collection_name, bm25_ids, bm25_docs)
        except Exception as e:
            print(f"Warning: Failed to add to vector store: {e}")

    def delete_document(self, document_id: str, collection_name: str = "global_knowledge_base") -> None:
        if not self.client:
            return
        try:
            collection = self.client.get_collection(name=collection_name)
            collection.delete(where={"document_id": str(document_id)})
        except Exception as e:
            print(f"Warning: Failed to delete document from vector store: {e}")

        if self._use_hybrid and BM25Okapi:
            try:
                bm25_ids, bm25_docs = self._load_bm25_corpus(collection_name)
                prefix = f"{document_id}_chunk_"
                new_ids = [i for i in bm25_ids if not i.startswith(prefix)]
                new_docs = [d for i, d in zip(bm25_ids, bm25_docs) if not i.startswith(prefix)]
                self._save_bm25_corpus(collection_name, new_ids, new_docs)
            except Exception as e:
                print(f"Warning: Failed to update BM25 corpus on delete: {e}")

    def delete_chunks(self, document_id: int, chunk_indices: list) -> None:
        if not self.client or not chunk_indices:
            return
        try:
            collection_name = f"doc_{document_id}"
            collection = self.client.get_collection(name=collection_name)
            ids_to_delete = [f"{document_id}_chunk_{i}" for i in chunk_indices]
            collection.delete(ids=ids_to_delete)
        except Exception as e:
            print(f"Warning: Failed to delete chunks from vector store: {e}")

    def _rrf_merge(
        self,
        vector_results: List[Dict[str, Any]],
        bm25_results: List[Dict[str, Any]],
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        """Reciprocal rank fusion. Both lists have 'id' and rest of fields."""
        scores: Dict[str, float] = {}
        seen: Dict[str, Dict[str, Any]] = {}
        for rank, r in enumerate(vector_results):
            rid = r.get("id") or ""
            if rid:
                scores[rid] = scores.get(rid, 0) + 1.0 / (k + rank + 1)
                seen[rid] = r
        for rank, r in enumerate(bm25_results):
            rid = r.get("id") or ""
            if rid:
                scores[rid] = scores.get(rid, 0) + 1.0 / (k + rank + 1)
                if rid not in seen:
                    seen[rid] = r
        ordered = sorted(scores.items(), key=lambda x: -x[1])
        return [seen[rid] for rid, _ in ordered]

    def search_similar(
        self,
        query: str,
        collection_name: str = "global_knowledge_base",
        n_results: int = 5,
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        fetch_k = max(n_results * 2, 10) if self._use_hybrid else n_results

        try:
            collection = self._get_collection(collection_name)
            results = collection.query(
                query_texts=[query],
                n_results=min(fetch_k, 100),
            )
            formatted = []
            if results and results.get("documents"):
                for i, doc in enumerate(results["documents"][0]):
                    formatted.append({
                        "content": doc,
                        "metadata": (results["metadatas"][0][i] if results.get("metadatas") else {}) or {},
                        "id": (results["ids"][0][i] if results.get("ids") else "") or "",
                    })
        except Exception as e:
            print(f"Warning: Failed to search vector store: {e}")
            formatted = []

        if not self._use_hybrid or not BM25Okapi:
            return formatted[:n_results]

        bm25_ids, bm25_docs = self._load_bm25_corpus(collection_name)
        if not bm25_docs:
            return formatted[:n_results]

        try:
            tokenized = [_tokenize_for_bm25(d) for d in bm25_docs]
            bm25 = BM25Okapi(tokenized)
            q_tokens = _tokenize_for_bm25(query)
            bm25_scores = bm25.get_scores(q_tokens)
            top_indices = sorted(
                range(len(bm25_scores)), key=lambda i: -bm25_scores[i]
            )[:fetch_k]
            bm25_results = []
            for idx in top_indices:
                if bm25_scores[idx] <= 0:
                    continue
                bm25_results.append({
                    "id": bm25_ids[idx],
                    "content": bm25_docs[idx],
                    "metadata": {},
                })
            merged = self._rrf_merge(formatted, bm25_results)
            return merged[:n_results]
        except Exception as e:
            print(f"Warning: BM25 search failed: {e}")
            return formatted[:n_results]
