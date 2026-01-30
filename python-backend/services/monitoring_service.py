"""
Monitoring Service
Handles task monitoring, progress tracking, and log management
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import json


class MonitoringService:
    def __init__(self, log_dir: str = "./logs"):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
    
    def log_job_progress(self, job_id: str, progress: float, status: str, details: Dict[str, Any] = None):
        """Log job progress"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "job_id": job_id,
            "progress": progress,
            "status": status,
            "details": details or {}
        }
        
        log_file = os.path.join(self.log_dir, f"job_{job_id}.log")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    def get_job_logs(self, job_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get job logs"""
        log_file = os.path.join(self.log_dir, f"job_{job_id}.log")
        
        if not os.path.exists(log_file):
            return []
        
        logs = []
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                try:
                    log_entry = json.loads(line.strip())
                    logs.append(log_entry)
                except:
                    continue
        
        return logs
    
    def update_job_status(self, job_id: str, status: str, progress: float = None):
        """Update job status"""
        self.log_job_progress(
            job_id,
            progress or 0.0,
            status,
            {"action": "status_update"}
        )
    
    def estimate_remaining_time(self, job_id: str, current_progress: float) -> Optional[float]:
        """Estimate remaining time based on progress history"""
        logs = self.get_job_logs(job_id, limit=10)
        
        if len(logs) < 2:
            return None
        
        # Calculate average progress rate
        time_diffs = []
        progress_diffs = []
        
        for i in range(1, len(logs)):
            prev_time = datetime.fromisoformat(logs[i-1]["timestamp"])
            curr_time = datetime.fromisoformat(logs[i]["timestamp"])
            time_diff = (curr_time - prev_time).total_seconds()
            
            prev_progress = logs[i-1]["progress"]
            curr_progress = logs[i]["progress"]
            progress_diff = curr_progress - prev_progress
            
            if progress_diff > 0:
                time_diffs.append(time_diff)
                progress_diffs.append(progress_diff)
        
        if not progress_diffs:
            return None
        
        avg_time_per_progress = sum(time_diffs) / sum(progress_diffs)
        remaining_progress = 1.0 - current_progress
        estimated_seconds = remaining_progress * avg_time_per_progress
        
        return estimated_seconds
    
    def get_cost_tracking(self, job_id: str) -> Dict[str, Any]:
        """Get cost tracking information for a job"""
        logs = self.get_job_logs(job_id)
        
        cost_entries = [log for log in logs if "cost" in log.get("details", {})]
        
        total_cost = sum(entry["details"]["cost"] for entry in cost_entries)
        
        return {
            "job_id": job_id,
            "total_cost": total_cost,
            "cost_entries": cost_entries,
            "entry_count": len(cost_entries)
        }
