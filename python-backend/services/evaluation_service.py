"""
Evaluation Service
Handles model evaluation, content generation, and comparison
"""
from typing import Dict, Any, List, Optional
from litellm import completion
import json
from datetime import datetime


class EvaluationService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key
    
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
            response = completion(
                model="gpt-4",
                messages=[{"role": "user", "content": comparison_prompt}],
                api_key=self.api_key
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
        Generate content using fine-tuned model with template
        """
        # Replace template variables with context values
        prompt = template
        for key, value in context.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))
        
        try:
            # If model_endpoint is provided, use it; otherwise use default model
            if model_endpoint:
                # Use custom endpoint for fine-tuned model
                response = completion(
                    model=model_endpoint,
                    messages=[{"role": "user", "content": prompt}],
                    api_key=api_key or self.api_key
                )
            else:
                response = completion(
                    model="gpt-4",
                    messages=[{"role": "user", "content": prompt}],
                    api_key=api_key or self.api_key
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
        """Get predefined template"""
        templates = {
            "proposal": """Generate a professional proposal document.

Title: {title}
Client: {client}
Objective: {objective}
Scope: {scope}
Timeline: {timeline}
Budget: {budget}

Please provide a comprehensive proposal covering:
1. Executive Summary
2. Problem Statement
3. Proposed Solution
4. Methodology
5. Timeline and Milestones
6. Budget Breakdown
7. Expected Outcomes
8. Conclusion""",
            
            "technical_solution": """Generate a technical solution document.

Project: {project_name}
Requirements: {requirements}
Technical Stack: {tech_stack}
Architecture: {architecture}

Please provide:
1. System Overview
2. Architecture Design
3. Technology Selection Rationale
4. Implementation Plan
5. Testing Strategy
6. Deployment Plan
7. Maintenance and Support""",
            
            "research_paper": """Generate an academic research paper.

Title: {title}
Abstract: {abstract}
Keywords: {keywords}
Introduction: {introduction}
Methodology: {methodology}
Results: {results}
Discussion: {discussion}

Please structure the paper with:
1. Abstract
2. Introduction
3. Literature Review
4. Methodology
5. Results
6. Discussion
7. Conclusion
8. References"""
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
