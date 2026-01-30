"""
Annotation Service
Handles automatic generation of instruction pairs and Q&A pairs via DeepSeek API (OpenAI-compatible)
"""
import logging
from typing import List, Dict, Any
from openai import OpenAI


DEEPSEEK_BASE_URL = "https://api.deepseek.com"
logger = logging.getLogger(__name__)


class AnnotationService:
    def __init__(self, api_key: str = None, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(
                api_key=self.api_key or "",
                base_url=DEEPSEEK_BASE_URL,
            )
        return self._client

    def generate_instruction_pair(self, knowledge_point: str) -> Dict[str, Any]:
        """
        Generate instruction pair from knowledge point using DeepSeek API
        Returns dict with 'instruction' and 'response' fields
        """
        prompt = f"""Based on the following knowledge point, generate a high-quality instruction-response pair for fine-tuning.

Knowledge Point:
{knowledge_point}

Generate an instruction that would help a model learn this knowledge, and provide an appropriate response.

Format:
Instruction: [instruction text]
Response: [response text]"""

        kp_preview = (knowledge_point[:60] + "...") if len(knowledge_point) > 60 else knowledge_point
        logger.info("AnnotationService: calling DeepSeek API, model=%s, kp_preview=%r", self.model, kp_preview)

        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                stream=False,
            )
            content = response.choices[0].message.content or ""
            logger.info("AnnotationService: DeepSeek API response received, content_len=%d", len(content))
            instruction_pair = self._parse_instruction_pair(content)
            return instruction_pair
        except Exception as e:
            logger.warning("AnnotationService: DeepSeek API error: %s", e)
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
            client = self._get_client()
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                stream=False,
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
