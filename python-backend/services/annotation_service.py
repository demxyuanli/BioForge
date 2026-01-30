"""
Annotation Service
Handles automatic generation of instruction pairs and Q&A pairs
"""
from typing import List, Dict, Any
from litellm import completion


class AnnotationService:
    def __init__(self, api_key: str = None, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
    
    def generate_instruction_pair(self, knowledge_point: str) -> Dict[str, Any]:
        """
        Generate instruction pair from knowledge point using cloud model
        Returns dict with 'instruction' and 'response' fields
        """
        prompt = f"""Based on the following knowledge point, generate a high-quality instruction-response pair for fine-tuning.

Knowledge Point:
{knowledge_point}

Generate an instruction that would help a model learn this knowledge, and provide an appropriate response.

Format:
Instruction: [instruction text]
Response: [response text]"""
        
        try:
            response = completion(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                api_key=self.api_key
            )
            
            content = response.choices[0].message.content
            # Parse instruction and response from content
            instruction_pair = self._parse_instruction_pair(content)
            return instruction_pair
        except Exception as e:
            return {"error": str(e)}
    
    def generate_qa_pair(self, context: str, question: str = None) -> Dict[str, Any]:
        """
        Generate Q&A pair from context
        """
        if question:
            prompt = f"""Context: {context}

Question: {question}

Generate a comprehensive answer based on the context."""
        else:
            prompt = f"""Based on the following context, generate a question-answer pair.

Context:
{context}

Generate a relevant question and provide a detailed answer."""
        
        try:
            response = completion(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                api_key=self.api_key
            )
            
            content = response.choices[0].message.content
            qa_pair = self._parse_qa_pair(content)
            return qa_pair
        except Exception as e:
            return {"error": str(e)}
    
    def generate_dpo_format(self, instruction: str, chosen_response: str, rejected_response: str) -> Dict[str, Any]:
        """
        Generate DPO format data for RLHF
        """
        return {
            "prompt": instruction,
            "chosen": chosen_response,
            "rejected": rejected_response
        }
    
    def _parse_instruction_pair(self, content: str) -> Dict[str, Any]:
        """Parse instruction pair from model response"""
        lines = content.split("\n")
        instruction = ""
        response = ""
        current_section = None
        
        for line in lines:
            if "Instruction:" in line or "instruction:" in line.lower():
                current_section = "instruction"
                instruction = line.split(":", 1)[1].strip()
            elif "Response:" in line or "response:" in line.lower():
                current_section = "response"
                response = line.split(":", 1)[1].strip()
            elif current_section == "instruction":
                instruction += " " + line.strip()
            elif current_section == "response":
                response += " " + line.strip()
        
        return {
            "instruction": instruction.strip(),
            "response": response.strip()
        }
    
    def _parse_qa_pair(self, content: str) -> Dict[str, Any]:
        """Parse Q&A pair from model response"""
        lines = content.split("\n")
        question = ""
        answer = ""
        current_section = None
        
        for line in lines:
            if "Question:" in line or "question:" in line.lower() or "Q:" in line:
                current_section = "question"
                question = line.split(":", 1)[-1].strip()
            elif "Answer:" in line or "answer:" in line.lower() or "A:" in line:
                current_section = "answer"
                answer = line.split(":", 1)[-1].strip()
            elif current_section == "question":
                question += " " + line.strip()
            elif current_section == "answer":
                answer += " " + line.strip()
        
        return {
            "question": question.strip(),
            "answer": answer.strip()
        }
