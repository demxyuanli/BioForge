"""
Document Processing Service
Handles document upload, OCR, text cleaning, and chunking.
Office documents (doc, odt, xls, ppt, etc.) can be parsed via LibreOffice headless.
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

try:
    from .libreoffice_parser import (
        extract_text_with_libreoffice,
        is_office_extension,
    )
except ImportError:
    extract_text_with_libreoffice = None
    is_office_extension = lambda ext: False


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
        ft = file_type.lower()
        if ft == "pdf":
            text = self.extract_text_from_pdf(file_path)
        elif ft in ["doc", "docx"]:
            text = self._extract_text_word_or_libreoffice(file_path, ft)
        elif extract_text_with_libreoffice and is_office_extension(ft):
            text = extract_text_with_libreoffice(file_path)
            if not text:
                text = f"Error extracting Office document (LibreOffice not available or conversion failed)"
        elif ft in ["md", "markdown"]:
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
    
    def _extract_text_word_or_libreoffice(self, file_path: str, file_type: str) -> str:
        """Extract text from Word: .doc via LibreOffice, .docx via python-docx with LibreOffice fallback."""
        ft = file_type.lower()
        if ft == "doc":
            if extract_text_with_libreoffice:
                text = extract_text_with_libreoffice(file_path)
                return text if text else "Error extracting .doc (LibreOffice not available or conversion failed)"
            return "Error: .doc requires LibreOffice; install LibreOffice and ensure soffice is on PATH or set SOFFICE_PATH"
        if ft == "docx" and DocxDocument:
            text = self.extract_text_from_word(file_path)
            if text and not text.startswith("Error"):
                return text
            if extract_text_with_libreoffice:
                fallback = extract_text_with_libreoffice(file_path)
                if fallback:
                    return fallback
            return text if text else "Error extracting Word document"
        if extract_text_with_libreoffice:
            return extract_text_with_libreoffice(file_path) or "Error extracting Word document"
        return "Error: Word support requires python-docx or LibreOffice"
    
    def extract_text_from_word(self, file_path: str) -> str:
        """Extract text from Word document (.docx only)"""
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
