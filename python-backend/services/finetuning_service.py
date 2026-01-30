"""
Fine-tuning Service
Handles cloud-based fine-tuning. Supports DeepSeek (api.deepseek.com).
"""
from typing import Dict, Any, List, Optional
import json


class FineTuningService:
    def __init__(self):
        self.supported_platforms = {
            "deepseek": {
                "platform": "deepseek",
                "models": ["deepseek-chat", "deepseek-r1"],
                "fine_tuning_type": "lora"
            }
        }

    def estimate_cost(self, dataset_size: int, model: str, platform: str) -> Dict[str, Any]:
        """
        Estimate fine-tuning cost
        Returns cost estimation in USD
        """
        base_costs = {
            "deepseek": {"per_1k_tokens": 0.008}
        }
        
        estimated_tokens = dataset_size * 1000  # Rough estimate
        platform_cost = base_costs.get(platform, {}).get("per_1k_tokens", 0.01)
        estimated_cost = (estimated_tokens / 1000) * platform_cost
        
        return {
            "estimated_cost_usd": estimated_cost,
            "dataset_size": dataset_size,
            "model": model,
            "platform": platform
        }
    
    def prepare_training_data(self, annotation_data: List[Dict[str, Any]], format_type: str = "sft") -> str:
        """
        Prepare training data in required format
        format_type: 'sft' (Supervised Fine-Tuning) or 'dpo' (Direct Preference Optimization)
        """
        if format_type == "sft":
            formatted_data = []
            for item in annotation_data:
                formatted_item = {
                    "messages": [
                        {"role": "user", "content": item.get("instruction", item.get("question", ""))},
                        {"role": "assistant", "content": item.get("response", item.get("answer", ""))}
                    ]
                }
                formatted_data.append(formatted_item)
        elif format_type == "dpo":
            formatted_data = []
            for item in annotation_data:
                formatted_item = {
                    "prompt": item.get("prompt", item.get("instruction", "")),
                    "chosen": item.get("chosen", item.get("response", "")),
                    "rejected": item.get("rejected", "")
                }
                formatted_data.append(formatted_item)
        
        return json.dumps(formatted_data, ensure_ascii=False, indent=2)
    
    def submit_finetuning_job(
        self,
        training_data_path: str,
        model: str,
        platform: str,
        api_key: str,
        job_name: str = "privatetune_job"
    ) -> Dict[str, Any]:
        """
        Submit fine-tuning job to cloud platform
        Returns job information including job_id
        """
        # This is a placeholder - actual implementation depends on platform API
        # LiteLLM provides unified interface but fine-tuning APIs vary by platform
        
        job_info = {
            "job_id": f"{platform}_{job_name}_{hash(training_data_path)}",
            "status": "submitted",
            "model": model,
            "platform": platform,
            "estimated_completion_time": "2-4 hours"
        }
        
        return job_info
    
    def check_job_status(self, job_id: str, platform: str, api_key: str) -> Dict[str, Any]:
        """
        Check fine-tuning job status
        """
        return {
            "job_id": job_id,
            "status": "running",
            "progress": 0.5,
            "estimated_time_remaining": "1 hour"
        }
    
    def get_finetuned_model_endpoint(self, job_id: str, platform: str) -> str:
        """
        Get endpoint URL for fine-tuned model
        """
        return f"https://api.{platform}.com/v1/finetuned/{job_id}"
