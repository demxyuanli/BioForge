"""
Evaluation Service
Handles model evaluation, content generation, and comparison via DeepSeek API (OpenAI-compatible)
"""
from typing import Dict, Any, List, Optional
from openai import OpenAI
from datetime import datetime


DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


class EvaluationService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self._client = None

    def _get_client(self, api_key: str = None) -> OpenAI:
        key = api_key or self.api_key
        if self._client is None and key:
            self._client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)
        return self._client

    def compare_responses(
        self,
        prompt: str,
        baseline_response: str,
        finetuned_response: str,
        evaluation_criteria: List[str] = None
    ) -> Dict[str, Any]:
        """
        Compare baseline and fine-tuned model responses
        Returns evaluation scores and analysis
        """
        if evaluation_criteria is None:
            evaluation_criteria = [
                "relevance",
                "accuracy",
                "completeness",
                "professionalism"
            ]

        comparison_prompt = f"""Compare two responses to the same prompt and evaluate them.

Prompt: {prompt}

Baseline Response:
{baseline_response}

Fine-tuned Response:
{finetuned_response}

Evaluation Criteria: {', '.join(evaluation_criteria)}

Provide scores (1-5) for each criterion for both responses, and an overall assessment."""

        try:
            client = self._get_client()
            if not client:
                return {"error": "API key not set"}
            response = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": comparison_prompt},
                ],
                stream=False,
            )
            analysis = response.choices[0].message.content
            return {
                "prompt": prompt,
                "baseline_response": baseline_response,
                "finetuned_response": finetuned_response,
                "analysis": analysis,
                "evaluation_criteria": evaluation_criteria,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}

    def generate_content(
        self,
        template: str,
        context: Dict[str, Any],
        model_endpoint: str = None,
        api_key: str = None
    ) -> Dict[str, Any]:
        """
        Generate content using DeepSeek (or custom model endpoint)
        """
        prompt = template
        for key, value in context.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))

        system_msg = (
            "You are a helpful assistant. Two rules: (1) Always respond in the same language as the user's message "
            "(Chinese input -> Chinese output, English input -> English output). "
            "(2) When the user provides an output template or format specification in Markdown, you must strictly "
            "follow that structure and output the result in valid Markdown (headings, lists, paragraphs). "
            "Do not omit sections; fill each section with appropriate content."
        )

        try:
            key = api_key or self.api_key
            client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)
            model = model_endpoint if model_endpoint else DEFAULT_MODEL
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                stream=False,
            )
            generated_content = response.choices[0].message.content
            return {
                "prompt": prompt,
                "generated_content": generated_content,
                "template": template,
                "context": context,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}
    
    def get_template(self, template_name: str) -> str:
        """Get predefined template as Markdown-format output specification"""
        templates = {
            "proposal": """# Output format (Markdown)

Generate a professional proposal document. **Strictly follow the structure below.** Use Markdown headings and lists.

## Template structure

```markdown
# {title}

**Client:** {client}
**Objective:** {objective}
**Scope:** {scope}
**Timeline:** {timeline}
**Budget:** {budget}

## 1. Executive Summary

## 2. Problem Statement

## 3. Proposed Solution

## 4. Methodology

## 5. Timeline and Milestones

## 6. Budget Breakdown

## 7. Expected Outcomes

## 8. Conclusion
```

## User request / context

{prompt}

---
Output the full document in Markdown according to the template structure above. Use the same language as the user request.""",

            "technical_solution": """# Output format (Markdown)

Generate a technical solution document. **Strictly follow the structure below.** Use Markdown headings, lists and code blocks where appropriate.

## Template structure

```markdown
# Technical Solution: {project_name}

**Requirements:** {requirements}
**Technical Stack:** {tech_stack}
**Architecture:** {architecture}

## 1. System Overview

## 2. Architecture Design

## 3. Technology Selection Rationale

## 4. Implementation Plan

## 5. Testing Strategy

## 6. Deployment Plan

## 7. Maintenance and Support
```

## User request / context

{prompt}

---
Output the full document in Markdown according to the template structure above. Use the same language as the user request.""",

            "research_paper": """# Output format (Markdown)

Generate an academic research paper. **Strictly follow the structure below.** Use Markdown headings and paragraphs.

## Template structure

```markdown
# {title}

**Keywords:** {keywords}

## Abstract

## 1. Introduction

## 2. Literature Review

## 3. Methodology

## 4. Results

## 5. Discussion

## 6. Conclusion

## References
```

## User request / context

{prompt}

---
Output the full document in Markdown according to the template structure above. Use the same language as the user request."""
        }

        return templates.get(template_name, "")
    
    def evaluate_quality_metrics(
        self,
        responses: List[str],
        reference_responses: List[str] = None
    ) -> Dict[str, Any]:
        """Calculate quality metrics for generated responses"""
        metrics = {
            "total_responses": len(responses),
            "average_length": sum(len(r) for r in responses) / len(responses) if responses else 0,
            "min_length": min(len(r) for r in responses) if responses else 0,
            "max_length": max(len(r) for r in responses) if responses else 0
        }
        
        if reference_responses and len(reference_responses) == len(responses):
            # Calculate similarity scores (simplified)
            similarities = []
            for resp, ref in zip(responses, reference_responses):
                # Simple word overlap similarity
                resp_words = set(resp.lower().split())
                ref_words = set(ref.lower().split())
                if ref_words:
                    similarity = len(resp_words & ref_words) / len(ref_words)
                    similarities.append(similarity)
            
            if similarities:
                metrics["average_similarity"] = sum(similarities) / len(similarities)
        
        return metrics
