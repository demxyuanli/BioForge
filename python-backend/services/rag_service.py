"""
RAG Service
Handles document structuring using RAG technology
"""
from typing import List, Dict, Any
import re

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None

try:
    import chromadb
except ImportError:
    chromadb = None


class RAGService:
    def __init__(self, chroma_db_path: str = "./chroma_db"):
        if chromadb:
            self.client = chromadb.PersistentClient(path=chroma_db_path)
        else:
            self.client = None
        
        if RecursiveCharacterTextSplitter:
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
        else:
            self.text_splitter = None
    
    def structure_document(self, text: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Structure long document into atomic knowledge points using RAG
        Returns list of structured knowledge points
        """
        if self.text_splitter:
            chunks = self.text_splitter.split_text(text)
        else:
            # Fallback: simple text splitting
            chunks = self._simple_split_text(text, chunk_size=1000, overlap=200)
        
        knowledge_points = []
        
        for i, chunk in enumerate(chunks):
            knowledge_point = {
                "id": f"{document_id}_chunk_{i}",
                "content": chunk,
                "chunk_index": i,
                "tags": []
            }
            knowledge_points.append(knowledge_point)
        
        return knowledge_points
    
    def _simple_split_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Simple text splitting fallback"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Try to break at sentence boundary
            chunk = text[start:end]
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            
            if break_point > chunk_size * 0.5:
                end = start + break_point + 1
            
            chunks.append(text[start:end])
            start = end - overlap
        
        return chunks
    
    def add_to_vector_store(self, knowledge_points: List[Dict[str, Any]], collection_name: str):
        """Add knowledge points to Chroma vector store"""
        if not self.client:
            return  # Skip if chromadb not available
        
        try:
            collection = self.client.get_or_create_collection(name=collection_name)
            
            ids = [kp["id"] for kp in knowledge_points]
            documents = [kp["content"] for kp in knowledge_points]
            metadatas = [{"chunk_index": kp["chunk_index"]} for kp in knowledge_points]
            
            collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
        except Exception as e:
            print(f"Warning: Failed to add to vector store: {e}")
    
    def search_similar(self, query: str, collection_name: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar knowledge points"""
        if not self.client:
            return []
        
        try:
            collection = self.client.get_or_create_collection(name=collection_name)
            results = collection.query(
                query_texts=[query],
                n_results=n_results
            )
            return results
        except Exception as e:
            print(f"Warning: Failed to search vector store: {e}")
            return []
