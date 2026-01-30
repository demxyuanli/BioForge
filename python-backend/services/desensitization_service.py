"""
Data Desensitization Service
Handles automatic desensitization of sensitive information
"""
import re
from typing import List, Dict, Any


class DesensitizationService:
    def __init__(self):
        # Common patterns for sensitive information
        self.patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            "id_card": r'\b\d{17}[\dXx]\b',
            "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
            "ip_address": r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        }
    
    def desensitize_text(self, text: str, patterns: List[str] = None) -> Dict[str, Any]:
        """
        Desensitize sensitive information in text
        Returns desensitized text and list of replaced items
        """
        if patterns is None:
            patterns = list(self.patterns.keys())
        
        desensitized_text = text
        replaced_items = []
        
        for pattern_name in patterns:
            if pattern_name in self.patterns:
                pattern = self.patterns[pattern_name]
                matches = re.finditer(pattern, desensitized_text)
                
                for match in matches:
                    original = match.group()
                    replacement = self._generate_replacement(pattern_name, original)
                    desensitized_text = desensitized_text.replace(original, replacement)
                    replaced_items.append({
                        "type": pattern_name,
                        "original": original,
                        "replacement": replacement
                    })
        
        return {
            "desensitized_text": desensitized_text,
            "replaced_items": replaced_items
        }
    
    def _generate_replacement(self, pattern_type: str, original: str) -> str:
        """Generate replacement string for sensitive information"""
        if pattern_type == "email":
            return "***@***.***"
        elif pattern_type == "phone":
            return "***-***-****"
        elif pattern_type == "id_card":
            return "******************"
        elif pattern_type == "credit_card":
            return "****-****-****-****"
        elif pattern_type == "ip_address":
            return "***.***.***.***"
        else:
            return "***"
