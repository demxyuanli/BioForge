"""
Annotation Service
Handles automatic generation of instruction pairs and Q&A pairs via DeepSeek API (OpenAI-compatible)
"""
import logging
import re
from typing import List, Dict, Any
from openai import OpenAI
import requests
import json

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
logger = logging.getLogger(__name__)


class AnnotationService:
    def __init__(self, api_key: str = None, model: str = "deepseek-chat", base_url: str = None):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self._client = None
        # self._is_ollama flag is removed in favor of direct base_url check

    def _get_client(self) -> OpenAI:
        if self._client is None:
            if self.base_url and self.base_url.strip():
                # Use provided base_url (Ollama, vLLM, local, etc.)
                self._client = OpenAI(
                    api_key=self.api_key or "ollama", # Many local servers need non-empty key
                    base_url=self.base_url,
                )
            else:
                # Default to DeepSeek Cloud
                self._client = OpenAI(
                    api_key=self.api_key or "",
                    base_url=DEEPSEEK_BASE_URL,
                )
        return self._client

    def generate_instruction_pair(
        self,
        knowledge_point: str,
        candidate_index: int = 1,
        candidate_total: int = 1,
        existing_candidates: List[Dict[str, str]] = None,
        skills_context: str = None,
    ) -> Dict[str, Any]:
        """
        Generate instruction pair from knowledge point using DeepSeek API
        Returns dict with 'instruction' and 'response' fields
        """
        candidate_hint = ""
        if candidate_total > 1:
            candidate_hint = (
                f"\nCandidate target: {candidate_index}/{candidate_total}.\n"
                "Make this candidate meaningfully different from other candidates by question angle, phrasing, and response structure."
            )

        existing_hint = ""
        if existing_candidates:
            samples = []
            for idx, item in enumerate(existing_candidates[:3], start=1):
                instruction = (item.get("instruction") or "").strip()
                response = (item.get("response") or "").strip()
                if instruction or response:
                    samples.append(f"{idx}. Instruction: {instruction}\n   Response: {response}")
            if samples:
                existing_hint = (
                    "\nExisting candidates (avoid semantic duplicates):\n"
                    + "\n".join(samples)
                )

        skills_block = ""
        if skills_context and (skills_context := (skills_context or "").strip()):
            skills_block = skills_context + "\n"

        prompt = f"""Based on the following knowledge point, generate a high-quality instruction-response pair for fine-tuning.
The output MUST be in Chinese (Simplified).
{skills_block}{candidate_hint}
{existing_hint}

If the input includes a "Keywords:" line (or equivalent keyword hints), you MUST treat those keywords as core terms and reflect them explicitly in both the instruction and the response.
Ensure terminology consistency with those keywords.

Knowledge Point:
{knowledge_point}

Generate an instruction that would help a model learn this knowledge, and provide an appropriate response.

Format:
Instruction: [instruction text in Chinese]
Response: [response text in Chinese]"""

        kp_preview = (knowledge_point[:60] + "...") if len(knowledge_point) > 60 else knowledge_point
        logger.info("AnnotationService: calling DeepSeek API, model=%s, kp_preview=%r", self.model, kp_preview)

        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant. You must output in Chinese."},
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

    def generate_instruction_candidates(self, knowledge_point: str, candidate_count: int = 1, skills_context: str = None) -> Dict[str, Any]:
        """
        Generate multiple instruction-response candidates for one knowledge point,
        then deduplicate them automatically.
        """
        target_count = max(1, min(10, int(candidate_count or 1)))
        annotations: List[Dict[str, str]] = []
        errors: List[str] = []
        seen = set()
        max_attempts = max(target_count * 4, target_count)

        for _ in range(max_attempts):
            if len(annotations) >= target_count:
                break
            result = self.generate_instruction_pair(
                knowledge_point=knowledge_point,
                candidate_index=len(annotations) + 1,
                candidate_total=target_count,
                existing_candidates=annotations,
                skills_context=skills_context,
            )
            if "error" in result:
                errors.append(str(result.get("error", "")))
                continue

            instruction = (result.get("instruction") or "").strip()
            response = (result.get("response") or "").strip()
            if not instruction or not response:
                errors.append("Empty instruction or response generated")
                continue

            dedupe_key = f"{self._normalize_text(instruction)}|||{self._normalize_text(response)}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            annotations.append({
                "instruction": instruction,
                "response": response
            })

        return {
            "annotations": annotations,
            "errors": errors
        }

    def generate_qa_pair(self, context: str, question: str = None) -> Dict[str, Any]:
        """
        Generate Q&A pair from context
        """
        if question:
            prompt = f"""Context: {context}

Question: {question}

Generate a comprehensive answer based on the context. The answer MUST be in Chinese (Simplified)."""
            try:
                client = self._get_client()
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant. You must output in Chinese."},
                        {"role": "user", "content": prompt},
                    ],
                    stream=False,
                )
                raw_content = response.choices[0].message.content if response.choices else None
                content = (raw_content or "").strip()
                logger.info("generate_qa_pair (with question): raw_content type=%s len=%s", type(raw_content).__name__, len(content) if content else 0)
                return {
                    "question": question,
                    "answer": content or "(No content returned)"
                }
            except Exception as e:
                logger.exception("generate_qa_pair error (with question): %s", e)
                return {"error": str(e)}
        else:
            prompt = f"""Based on the following context, generate a question-answer pair.
The output MUST be in Chinese (Simplified).

Context:
{context}

Generate a relevant question and provide a detailed answer.

Format:
Question: [question text in Chinese]
Answer: [answer text in Chinese]"""
            try:
                client = self._get_client()
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant. You must output in Chinese."},
                        {"role": "user", "content": prompt},
                    ],
                    stream=False,
                )
                raw_content = response.choices[0].message.content if response.choices else None
                content = (raw_content or "").strip()
                logger.info("generate_qa_pair (no question): raw_content len=%s", len(content))
                qa_pair = self._parse_qa_pair(content) if content else {"question": "", "answer": "(No content returned)"}
                return qa_pair
            except Exception as e:
                logger.exception("generate_qa_pair error (no question): %s", e)
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

    def _normalize_text(self, text: str) -> str:
        normalized = re.sub(r"\s+", " ", (text or "").strip().lower())
        return normalized

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
