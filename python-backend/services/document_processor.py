"""
Document Processing Service
Handles document upload, OCR, text cleaning, and chunking
"""
from typing import List, Dict, Any
import os
from pathlib import Path
import re
try:
    import PyPDF2
except ImportError:
    PyPDF2 = None
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None
try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None


class DocumentProcessor:
    def __init__(self):
        pass
    
    def process_document(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Process a document based on its type
        Returns structured document data
        """
        if not os.path.exists(file_path):
            return {"error": "File not found"}
        
        text = ""
        if file_type.lower() == "pdf":
            text = self.extract_text_from_pdf(file_path)
        elif file_type.lower() in ["doc", "docx"]:
            text = self.extract_text_from_word(file_path)
        elif file_type.lower() in ["md", "markdown"]:
            text = self.extract_text_from_markdown(file_path)
        elif file_type.lower() in ["jpg", "jpeg", "png", "bmp", "tiff"]:
            text = self.ocr_image(file_path)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        
        cleaned_text = self.clean_text(text)
        chunks = self.chunk_document(cleaned_text)
        
        return {
            "file_path": file_path,
            "file_type": file_type,
            "original_text": text,
            "cleaned_text": cleaned_text,
            "chunks": chunks,
            "chunk_count": len(chunks),
            "total_length": len(cleaned_text)
        }
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        if PyPDF2 is None:
            return ""
        
        text = ""
        try:
            with open(file_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
        except Exception as e:
            return f"Error extracting PDF: {str(e)}"
        
        return text
    
    def extract_text_from_word(self, file_path: str) -> str:
        """Extract text from Word document"""
        if DocxDocument is None:
            return ""
        
        text = ""
        try:
            doc = DocxDocument(file_path)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        except Exception as e:
            return f"Error extracting Word document: {str(e)}"
        
        return text
    
    def extract_text_from_markdown(self, file_path: str) -> str:
        """Extract text from Markdown file"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Error reading Markdown file: {str(e)}"
    
    def ocr_image(self, image_path: str) -> str:
        """Perform OCR on image file"""
        if pytesseract is None or Image is None:
            return ""
        
        try:
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image, lang="eng+chi_sim")
            return text
        except Exception as e:
            return f"Error performing OCR: {str(e)}"
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special control characters
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        # Normalize line breaks
        text = re.sub(r'\n\s*\n', '\n\n', text)
        # Trim
        text = text.strip()
        return text
    
    def chunk_document(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split document into chunks"""
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
