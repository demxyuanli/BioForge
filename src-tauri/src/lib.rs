// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::{Command, Child};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::net::TcpListener;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::fs;
use tauri::Manager;

#[cfg(windows)]
struct JobHandleGuard(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandleGuard {}
#[cfg(windows)]
unsafe impl Sync for JobHandleGuard {}

#[cfg(windows)]
impl Drop for JobHandleGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

pub struct BackendProcess {
    pub child: Child,
    #[cfg(windows)]
    _job: Option<JobHandleGuard>,
}

pub struct BackendState {
    pub process: Mutex<Option<BackendProcess>>,
}

pub struct OllamaState {
    pub process: Mutex<Option<Child>>,
}

#[tauri::command]
async fn upload_document(file_path: String) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
import os

file_path = r"{}"

if not os.path.exists(file_path):
    result = {{
        "success": False,
        "data": None,
        "error": "File not found"
    }}
    print(json.dumps(result))
    sys.exit(1)

try:
    with open(file_path, 'rb') as f:
        files = {{'file': (os.path.basename(file_path), f, 'application/octet-stream')}}
        response = requests.post('http://127.0.0.1:8778/documents/upload', files=files)
    
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        file_path.replace('\\', "\\\\")
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn generate_annotations(
    knowledge_points: Vec<String>,
    api_key: String,
    model: String,
    base_url: Option<String>,
    platform: Option<String>,
    candidate_count: Option<i32>,
) -> Result<String, String> {
    let kp_json = serde_json::to_string(&knowledge_points).unwrap_or_else(|_| "[]".to_string());
    let kp_escaped = kp_json.replace('\\', "\\\\").replace('"', "\\\"");
    let api_key_escaped = api_key.replace('\\', "\\\\").replace('"', "\\\"");
    let model_escaped = model.replace('\\', "\\\\").replace('"', "\\\"");
    let base_url_val = base_url.unwrap_or_default();
    let base_url_escaped = base_url_val.replace('\\', "\\\\").replace('"', "\\\"");
    let platform_val = platform.unwrap_or_default();
    let platform_escaped = platform_val.replace('\\', "\\\\").replace('"', "\\\"");
    let candidate_count_val = candidate_count.unwrap_or(1).clamp(1, 10);

    let python_script = format!(
        r#"
import sys
import requests
import json

kp_json = "{}"
knowledge_points = json.loads(kp_json) if kp_json else []
api_key = "{}"
model = "{}"
base_url = "{}"
platform = "{}"
candidate_count = {}

payload = {{"knowledge_points": knowledge_points, "api_key": api_key, "model": model, "base_url": base_url if base_url else None}}
if platform:
    payload["platform"] = platform
payload["candidate_count"] = candidate_count

try:
    response = requests.post(
        'http://127.0.0.1:8778/annotations/generate',
        json=payload
    )
    
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        kp_escaped,
        api_key_escaped,
        model_escaped,
        base_url_escaped,
        platform_escaped,
        candidate_count_val
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn estimate_finetuning_cost(dataset_size: i32, model: String, platform: String) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.post(
        'http://127.0.0.1:8778/finetuning/estimate',
        json={{
            "dataset_size": {},
            "model": "{}",
            "platform": "{}"
        }}
    )
    
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        dataset_size, model, platform
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn submit_finetuning_job(
    annotations: Vec<serde_json::Value>,
    platform: String,
    model: String,
    api_key: String,
    format_type: String
) -> Result<String, String> {
    let payload = serde_json::json!({
        "training_data": {
            "annotations": annotations,
            "format_type": format_type
        },
        "platform": platform,
        "model": model,
        "api_key": api_key
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let payload_path = std::env::temp_dir().join(format!("bioforger_finetune_submit_{}_{}.json", std::process::id(), ts));
    fs::write(&payload_path, payload_str).map_err(|e| format!("Failed to write temp payload: {}", e))?;

    let python_script = r#"
import sys
import requests
import json

try:
    payload_path = sys.argv[1]
    with open(payload_path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    response = requests.post(
        'http://127.0.0.1:8778/finetuning/submit',
        json=payload
    )
    
    result = {
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }
    print(json.dumps(result))
except Exception as e:
    result = {
        "success": False,
        "data": None,
        "error": str(e)
    }
    print(json.dumps(result))
"#;

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .arg(payload_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| {
            let _ = fs::remove_file(&payload_path);
            format!("Failed to execute Python: {}", e)
        })?;
    let _ = fs::remove_file(&payload_path);

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_documents() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json

try:
    response = requests.get('http://127.0.0.1:8778/documents')
    result = {
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }
    print(json.dumps(result))
except Exception as e:
    result = {
        "success": False,
        "data": None,
        "error": str(e)
    }
    print(json.dumps(result))
"#;

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn delete_document(document_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

document_id = {}

try:
    response = requests.delete('http://127.0.0.1:8778/documents/{{}}'.format(document_id))
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        document_id
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_knowledge_points(
    page: Option<i32>,
    page_size: Option<i32>,
    document_id: Option<i32>,
    min_weight: Option<f64>,
) -> Result<String, String> {
    let page_val = page.unwrap_or(1);
    let page_size_val = page_size.unwrap_or(50);
    
    let mut url = format!("http://127.0.0.1:8778/documents/knowledge-points?page={}&page_size={}", page_val, page_size_val);
    
    if let Some(doc_id) = document_id {
        url.push_str(&format!("&document_id={}", doc_id));
    }
    if let Some(w) = min_weight {
        url.push_str(&format!("&min_weight={}", w));
    }

    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.get('{}')
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        url
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

const GRAPH_PAGE_SIZE: i32 = 500;

#[tauri::command]
async fn get_knowledge_points_for_graph(page: Option<i32>, min_weight: Option<f64>) -> Result<String, String> {
    let page_val = page.unwrap_or(1);
    let min_val = min_weight.unwrap_or(1.0);
    let min_val = if min_val < 1.0 { 1.0 } else if min_val > 5.0 { 5.0 } else { min_val };
    let url = format!(
        "http://127.0.0.1:8778/documents/knowledge-points?page={}&page_size={}&min_weight={}",
        page_val,
        GRAPH_PAGE_SIZE,
        min_val
    );

    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.get('{}')
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        url
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn delete_knowledge_points_batch(ids: Vec<i32>) -> Result<String, String> {
    let ids_json = serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json

ids = json.loads('{}')
try:
    response = requests.delete('http://127.0.0.1:8778/documents/knowledge-points/batch', json={{"ids": ids}})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        ids_json.replace('\\', "\\\\").replace('\'', "\\'")
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn update_knowledge_point_weight(kp_id: i32, weight: f64) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.patch('http://127.0.0.1:8778/documents/knowledge-points/{}', json={{ "weight": {} }})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        kp_id,
        weight
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn update_knowledge_point_excluded(kp_id: i32, excluded: bool) -> Result<String, String> {
    let excluded_str = if excluded { "True" } else { "False" };
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.patch('http://127.0.0.1:8778/documents/knowledge-points/{}/excluded', json={{ "excluded": {} }})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        kp_id,
        excluded_str
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn add_knowledge_point_keyword(kp_id: i32, keyword: String) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.post('http://127.0.0.1:8778/documents/knowledge-points/{}/keywords', json={{ "keyword": {} }})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        kp_id,
        serde_json::to_string(&keyword).unwrap()
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn remove_knowledge_point_keyword(kp_id: i32, keyword: String) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.delete('http://127.0.0.1:8778/documents/knowledge-points/{}/keywords', json={{ "keyword": {} }})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        kp_id,
        serde_json::to_string(&keyword).unwrap()
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_knowledge_point_keywords(kp_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

try:
    response = requests.get('http://127.0.0.1:8778/documents/knowledge-points/{}/keywords')
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        kp_id
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn create_knowledge_point(document_id: i32, content: String) -> Result<String, String> {
    let payload = serde_json::json!({
        "document_id": document_id,
        "content": content
    });
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    response = requests.post('http://127.0.0.1:8778/documents/knowledge-points', json=payload)
    result = {
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }
    print(json.dumps(result))
except Exception as e:
    result = {"success": False, "data": None, "error": str(e)}
    print(json.dumps(result))
"#;
    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .arg(&payload_str)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_finetuning_jobs() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json

try:
    response = requests.get('http://127.0.0.1:8778/finetuning/jobs')
    result = {
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }
    print(json.dumps(result))
except Exception as e:
    result = {
        "success": False,
        "data": None,
        "error": str(e)
    }
    print(json.dumps(result))
"#;

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_job_logs(job_id: String, limit: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

job_id = "{}"
limit = {}

try:
    response = requests.get('http://127.0.0.1:8778/finetuning/jobs/{{}}/logs?limit={{}}'.format(job_id, limit))
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        job_id, limit
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn get_job_status(job_id: String) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json

job_id = "{}"

try:
    response = requests.get('http://127.0.0.1:8778/finetuning/jobs/{{}}/status'.format(job_id))
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        job_id
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn save_api_key(platform: String, api_key: String) -> Result<String, String> {
    let payload = serde_json::json!({"platform": platform, "api_key": api_key});
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/api-keys', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_api_keys() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/api-keys')
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn save_training_set(annotations: Vec<serde_json::Value>, training_item_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "annotations": annotations,
        "training_item_id": training_item_id
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/training-set', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_training_set(training_item_id: Option<i32>) -> Result<String, String> {
    let training_item_id_val = training_item_id
        .map(|v| v.to_string())
        .unwrap_or_else(|| "".to_string());
    let python_script = format!(r#"
import sys
import requests
import json
try:
    params = {{}}
    training_item_id = "{}"
    if training_item_id:
        params["training_item_id"] = training_item_id
    r = requests.get('http://127.0.0.1:8778/training-set', params=params)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        training_item_id_val
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_training_items() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/training-items')
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn save_training_item(
    name: String,
    knowledge_point_keys: Vec<String>,
    prompt_template: String
) -> Result<String, String> {
    let payload = serde_json::json!({
        "name": name,
        "knowledge_point_keys": knowledge_point_keys,
        "prompt_template": prompt_template
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/training-items', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn delete_training_item(item_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.delete('http://127.0.0.1:8778/training-items/{}')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        item_id
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_audit_log(limit: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/audit-log', params={{"limit": {}}})
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        limit
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_desensitization_log(limit: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/desensitization-log', params={{"limit": {}}})
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        limit
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn evaluation_generate(
    prompt: String,
    template: String,
    api_key: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "prompt": prompt,
        "template": template,
        "api_key": api_key.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/evaluation/generate', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn chat_query(
    query: String,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "query": query,
        "api_key": api_key.unwrap_or_default(),
        "model": model.unwrap_or("deepseek-chat".to_string()),
        "base_url": base_url.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/chat/query', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}


#[tauri::command]
async fn list_system_dir(path: String) -> Result<String, String> {
    let mut entries = Vec::new();
    match fs::read_dir(&path) {
        Ok(dir) => {
            for entry in dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue;
                }
                let is_dir = entry.metadata().map(|m| m.is_dir()).unwrap_or(false);
                entries.push(serde_json::json!({
                    "name": name,
                    "isDirectory": is_dir
                }));
            }
            entries.sort_by(|a, b| {
                let a_dir = a["isDirectory"].as_bool().unwrap_or(false);
                let b_dir = b["isDirectory"].as_bool().unwrap_or(false);
                if a_dir != b_dir {
                    return if a_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
                }
                let a_name = a["name"].as_str().unwrap_or("");
                let b_name = b["name"].as_str().unwrap_or("");
                a_name.cmp(b_name)
            });
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    Ok(serde_json::to_string(&entries).unwrap_or_else(|_| "[]".to_string()))
}

#[tauri::command]
async fn get_file_icon(file_path: String) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        use windows_icons::get_icon_base64_by_path;
        match get_icon_base64_by_path(&file_path) {
            Ok(base64) => Ok(Some(base64)),
            Err(_) => Ok(None),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = file_path;
        Ok(None)
    }
}

#[tauri::command]
async fn get_directories() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json

try:
    response = requests.get('http://127.0.0.1:8778/directories')
    result = {
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }
    print(json.dumps(result))
except Exception as e:
    result = {
        "success": False,
        "data": None,
        "error": str(e)
    }
    print(json.dumps(result))
"#;

    let output = Command::new("python")
        .arg("-c")
        .arg(python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
async fn create_directory(name: String, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "name": name,
        "parent_id": parent_id
    });
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/directories', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn move_document(document_id: i32, directory_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "directory_id": directory_id
    });
    let payload_str = payload.to_string();
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.put('http://127.0.0.1:8778/documents/{}/move', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        document_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn move_directory(directory_id: i32, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "parent_id": parent_id
    });
    let payload_str = payload.to_string();
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.put('http://127.0.0.1:8778/directories/{}/move', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        directory_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn delete_all_mount_points() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.delete('http://127.0.0.1:8778/mount-points')
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_mount_points() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/mount-points')
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn create_mount_point(path: String, name: Option<String>, description: Option<String>) -> Result<String, String> {
    let payload = serde_json::json!({
        "path": path,
        "name": name.unwrap_or_default(),
        "description": description.unwrap_or_default()
    });
    let payload_str = payload.to_string();
    let python_script = r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.post('http://127.0.0.1:8778/mount-points', json=payload)
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn update_mount_point(mp_id: i32, path: Option<String>, name: Option<String>, description: Option<String>) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    if let Some(p) = path { payload.insert("path".to_string(), serde_json::json!(p)); }
    if let Some(n) = name { payload.insert("name".to_string(), serde_json::json!(n)); }
    if let Some(d) = description { payload.insert("description".to_string(), serde_json::json!(d)); }
    let payload_str = serde_json::Value::Object(payload).to_string();
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.patch('http://127.0.0.1:8778/mount-points/{}', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_mount_point_document_stats(mp_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/mount-points/{}/document-stats')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_recent_annotated_files() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/mount-points/recent-annotated-files')
    out = {"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"success": False, "data": None, "error": str(e)}))
"#;
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_mount_point_files(mp_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/mount-points/{}/files')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn update_mount_point_file_meta(mp_id: i32, relative_path: String, weight: Option<f64>, note: Option<String>) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    payload.insert("relative_path".to_string(), serde_json::json!(relative_path));
    if let Some(w) = weight { payload.insert("weight".to_string(), serde_json::json!(w)); }
    if let Some(n) = note { payload.insert("note".to_string(), serde_json::json!(n)); }
    let payload_str = serde_json::Value::Object(payload).to_string();
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    payload = json.loads(sys.argv[1])
    r = requests.patch('http://127.0.0.1:8778/mount-points/{}/files/meta', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).arg(&payload_str).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_document_summary(mp_id: i32, relative_path: String) -> Result<String, String> {
    let rel_escaped = relative_path.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/mount-points/document-summary', params={{"mp_id": {}, "relative_path": "{}"}})
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id,
        rel_escaped
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_document_preview(mp_id: i32, relative_path: String) -> Result<String, String> {
    let rel_escaped = relative_path.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
import base64
try:
    r = requests.get('http://127.0.0.1:8778/mount-points/document-preview', params={{"mp_id": {}, "relative_path": "{}"}})
    if r.status_code != 200:
        out = {{"success": False, "data": None, "version": "", "error": r.text}}
    else:
        ver = r.headers.get("X-Preview-Version") or r.headers.get("x-preview-version") or ""
        out = {{"success": True, "data": base64.b64encode(r.content).decode(), "version": ver if isinstance(ver, str) else "", "error": None}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id,
        rel_escaped
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_document_summary_by_id(document_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/documents/{}/summary')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        document_id
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_document_preview_by_id(document_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
import base64
try:
    r = requests.get('http://127.0.0.1:8778/documents/{}/preview')
    if r.status_code != 200:
        out = {{"success": False, "data": None, "version": "", "error": r.text}}
    else:
        ver = r.headers.get("X-Preview-Version") or r.headers.get("x-preview-version") or ""
        out = {{"success": True, "data": base64.b64encode(r.content).decode(), "version": ver if isinstance(ver, str) else "", "error": None}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        document_id
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn delete_mount_point(mp_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.delete('http://127.0.0.1:8778/mount-points/{}')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        mp_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn delete_directory(directory_id: i32) -> Result<String, String> {
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    r = requests.delete('http://127.0.0.1:8778/directories/{}')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        directory_id
    );
    let output = Command::new("python").arg("-c").arg(python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_local_models(base_url: Option<String>) -> Result<String, String> {
    let base_url_val = base_url.unwrap_or("http://localhost:11434".to_string());
    // Escape base_url to prevent injection/errors in python script
    let base_url_escaped = base_url_val.replace('\\', "\\\\").replace('"', "\\\"");
    
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    response = requests.get('http://127.0.0.1:8778/models/local', params={{"base_url": "{}"}})
    result = {{
        "success": response.status_code == 200,
        "data": response.json() if response.status_code == 200 else None,
        "error": None if response.status_code == 200 else response.text
    }}
    print(json.dumps(result))
except Exception as e:
    result = {{
        "success": False,
        "data": None,
        "error": str(e)
    }}
    print(json.dumps(result))
"#,
        base_url_escaped
    );

    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

const CONFIG_FILENAME: &str = "bioforger-config.json";
const DEFAULT_BACKEND_PORT: u16 = 8778;
const BACKEND_PORT_CONFIG_KEY: &str = "backendPort";

fn get_config_path_from_app(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join(CONFIG_FILENAME))
}

fn get_backend_port_from_env() -> u16 {
    std::env::var("BIOFORGER_BACKEND_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .filter(|p| *p > 0)
        .unwrap_or(DEFAULT_BACKEND_PORT)
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn pick_available_backend_port(preferred: u16) -> u16 {
    if is_port_available(preferred) {
        return preferred;
    }
    let end = preferred.saturating_add(200);
    let mut p = preferred.saturating_add(1);
    while p <= end {
        if is_port_available(p) {
            return p;
        }
        p = p.saturating_add(1);
    }
    preferred
}

fn read_backend_port_from_config(config_path: &PathBuf) -> Option<u16> {
    let contents = fs::read_to_string(config_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&contents).ok()?;
    json.get(BACKEND_PORT_CONFIG_KEY)
        .and_then(|v| v.as_u64())
        .and_then(|v| u16::try_from(v).ok())
        .filter(|p| *p > 0)
}

fn write_backend_port_to_config(config_path: &PathBuf, backend_port: u16) -> Result<(), String> {
    let mut config = if config_path.exists() {
        let raw = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !config.is_object() {
        config = serde_json::json!({});
    }
    if let Some(obj) = config.as_object_mut() {
        obj.insert(BACKEND_PORT_CONFIG_KEY.to_string(), serde_json::json!(backend_port));
    }
    let parent = config_path.parent().ok_or("Invalid config path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    fs::write(config_path, config.to_string()).map_err(|e| e.to_string())
}

fn resolve_backend_port(config_path: Option<&PathBuf>) -> u16 {
    if let Some(cfg) = config_path {
        if let Some(p) = read_backend_port_from_config(cfg) {
            return p;
        }
        let chosen = pick_available_backend_port(DEFAULT_BACKEND_PORT);
        let _ = write_backend_port_to_config(cfg, chosen);
        return chosen;
    }
    DEFAULT_BACKEND_PORT
}

fn configure_python_env(backend_dir: &Path, backend_port: u16) {
    std::env::set_var("BIOFORGER_BACKEND_PORT", backend_port.to_string());
    let backend_dir_str = backend_dir.to_string_lossy().to_string();
    let sep = if cfg!(windows) { ';' } else { ':' };
    let existing = std::env::var("PYTHONPATH").unwrap_or_default();
    let exists = existing
        .split(sep)
        .any(|item| !item.trim().is_empty() && item == backend_dir_str);
    if !exists {
        let merged = if existing.trim().is_empty() {
            backend_dir_str
        } else {
            format!("{}{}{}", backend_dir_str, sep, existing)
        };
        std::env::set_var("PYTHONPATH", merged);
    }
}

fn migrate_config_from_legacy(app_config_path: &PathBuf) {
    let legacy = find_main_py_path()
        .and_then(|p| p.parent().map(|d| d.join(CONFIG_FILENAME)));
    if let Some(ref old) = legacy {
        if old.exists() && !app_config_path.exists() {
            if let Some(parent) = app_config_path.parent() {
                let _ = fs::create_dir_all(parent);
                let _ = fs::copy(old, app_config_path);
            }
        }
    }
}

#[tauri::command]
fn get_storage_config(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let config_path = get_config_path_from_app(&app).ok_or("Config path not found")?;
    migrate_config_from_legacy(&config_path);
    if !config_path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    Ok(Some(v))
}

#[tauri::command]
fn get_default_storage_paths() -> Result<serde_json::Value, String> {
    let backend_dir = find_main_py_path()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .ok_or("Backend dir not found")?;
    let docs = backend_dir.join("documents");
    let db = backend_dir.join("privatetune.db");
    Ok(serde_json::json!({
        "documentsDir": docs.to_string_lossy(),
        "dbPath": db.to_string_lossy()
    }))
}

#[tauri::command]
fn save_storage_config(app: tauri::AppHandle, documents_dir: String, db_path: String) -> Result<(), String> {
    let config_path = get_config_path_from_app(&app).ok_or("Config path not found")?;
    let parent = config_path
        .parent()
        .ok_or("Invalid config path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut config = if config_path.exists() {
        let raw = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !config.is_object() {
        config = serde_json::json!({});
    }
    if let Some(obj) = config.as_object_mut() {
        obj.insert("documentsDir".to_string(), serde_json::json!(documents_dir));
        obj.insert("dbPath".to_string(), serde_json::json!(db_path));
        if !obj.contains_key(BACKEND_PORT_CONFIG_KEY) {
            obj.insert(
                BACKEND_PORT_CONFIG_KEY.to_string(),
                serde_json::json!(get_backend_port_from_env())
            );
        }
    }
    fs::write(config_path, config.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}

fn find_main_py_path() -> Option<PathBuf> {
    if let Ok(current_dir) = std::env::current_dir() {
        let dev_path = current_dir.join("python-backend").join("main.py");
        if dev_path.exists() {
            return Some(dev_path);
        }
        if let Some(parent_dir) = current_dir.parent() {
            let parent_path = parent_dir.join("python-backend").join("main.py");
            if parent_path.exists() {
                return Some(parent_path);
            }
        }
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let prod_path = exe_dir.join("python-backend").join("main.py");
            if prod_path.exists() {
                return Some(prod_path);
            }
        }
    }
    None
}

fn kill_process_on_port(port: u16) {
    #[cfg(windows)]
    {
        let port_str = format!(":{}", port);
        let output = match Command::new("netstat")
            .args(["-ano"])
            .output()
        {
            Ok(o) => o,
            Err(_) => return,
        };
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains(&port_str) && line.contains("LISTENING") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid_str) = parts.last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        if pid != 0 {
                            let _ = Command::new("taskkill")
                                .args(["/PID", &pid.to_string(), "/F"])
                                .output();
                        }
                    }
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = port;
    }
}

async fn ensure_python_backend_running(config_path: Option<PathBuf>) -> Result<Option<BackendProcess>, String> {
    let python_path = find_main_py_path()
        .ok_or("Python backend main.py not found. Please ensure python-backend/main.py exists.")?;
    let backend_dir = python_path.parent()
        .ok_or("Invalid path")?
        .to_path_buf();
    let backend_port = resolve_backend_port(config_path.as_ref());
    configure_python_env(&backend_dir, backend_port);
    let health_url = format!("http://127.0.0.1:{}/health", backend_port);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    if let Ok(resp) = client.get(&health_url).send().await {
        if resp.status().is_success() {
            return Ok(None);
        }
    }

    kill_process_on_port(backend_port);
    std::thread::sleep(Duration::from_millis(500));

    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
            JobObjectExtendedLimitInformation, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        };
        use windows::Win32::Foundation::CloseHandle;
        use windows::core::PCWSTR;

        let job_handle = unsafe {
            CreateJobObjectW(None, PCWSTR::null())
        }.map_err(|e| format!("CreateJobObject failed: {}", e))?;

        let mut limit = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limit.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                job_handle,
                JobObjectExtendedLimitInformation,
                &limit as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        }.is_err() {
            let _ = unsafe { CloseHandle(job_handle) };
            return Err("SetInformationJobObject failed".to_string());
        }

        let mut cmd = Command::new("python");
        cmd.arg(python_path.to_str().ok_or("Invalid path")?);
        cmd.current_dir(&backend_dir);
        cmd.env("PORT", backend_port.to_string());
        cmd.env("BIOFORGER_BACKEND_PORT", backend_port.to_string());
        if let Some(ref cfg_path) = config_path {
            cmd.env("BIOFORGER_CONFIG_PATH", cfg_path.to_string_lossy().to_string());
            if cfg_path.exists() {
                if let Ok(contents) = fs::read_to_string(cfg_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) {
                        if let Some(db) = config.get("dbPath").and_then(|v| v.as_str()) {
                            if !db.is_empty() {
                                cmd.env("BIOFORGER_DB_PATH", db);
                            }
                        }
                        if let Some(doc) = config.get("documentsDir").and_then(|v| v.as_str()) {
                            if !doc.is_empty() {
                                cmd.env("BIOFORGER_DOCUMENTS_DIR", doc);
                            }
                        }
                    }
                }
            }
        }
        let child = cmd.spawn()
            .map_err(|e| format!("Failed to start Python backend: {}", e))?;

        let child_handle = child.as_raw_handle();
        if unsafe {
            AssignProcessToJobObject(job_handle, windows::Win32::Foundation::HANDLE(child_handle as _))
        }.is_err() {
            let _ = unsafe { CloseHandle(job_handle) };
            return Err("AssignProcessToJobObject failed".to_string());
        }

        return Ok(Some(BackendProcess {
            child,
            _job: Some(JobHandleGuard(job_handle)),
        }));
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("python");
        cmd.arg(python_path.to_str().ok_or("Invalid path")?);
        cmd.current_dir(&backend_dir);
        cmd.env("PORT", backend_port.to_string());
        cmd.env("BIOFORGER_BACKEND_PORT", backend_port.to_string());
        if let Some(ref cfg_path) = config_path {
            cmd.env("BIOFORGER_CONFIG_PATH", cfg_path.to_string_lossy().to_string());
            if cfg_path.exists() {
                if let Ok(contents) = fs::read_to_string(cfg_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) {
                        if let Some(db) = config.get("dbPath").and_then(|v| v.as_str()) {
                            if !db.is_empty() {
                                cmd.env("BIOFORGER_DB_PATH", db);
                            }
                        }
                        if let Some(doc) = config.get("documentsDir").and_then(|v| v.as_str()) {
                            if !doc.is_empty() {
                                cmd.env("BIOFORGER_DOCUMENTS_DIR", doc);
                            }
                        }
                    }
                }
            }
        }
        let child = cmd.spawn()
            .map_err(|e| format!("Failed to start Python backend: {}", e))?;
        Ok(Some(BackendProcess { child }))
    }
}

const OLLAMA_PORT: u16 = 11434;

#[tauri::command]
async fn start_python_backend(app: tauri::AppHandle) -> Result<String, String> {
    let config_path = get_config_path_from_app(&app);
    match ensure_python_backend_running(config_path).await {
        Ok(None) => Ok("Python backend already running".to_string()),
        Ok(Some(_)) => Ok("Python backend started".to_string()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn stop_python_backend(state: tauri::State<'_, BackendState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(get_backend_port_from_env());
    Ok("Python backend stopped".to_string())
}

fn is_ollama_running() -> bool {
    let url = format!("http://127.0.0.1:{}/api/tags", OLLAMA_PORT);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(1))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    tauri::async_runtime::block_on(async move {
        client
            .get(&url)
            .send()
            .await
            .map(|r: reqwest::Response| r.status().is_success())
            .unwrap_or(false)
    })
}

#[tauri::command]
async fn start_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
    if is_ollama_running() {
        return Ok("OLLAMA already running".to_string());
    }
    let child = Command::new("ollama")
        .arg("serve")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start OLLAMA: {}", e))?;
    if let Ok(mut guard) = state.process.lock() {
        *guard = Some(child);
    }
    Ok("OLLAMA started".to_string())
}

#[tauri::command]
async fn stop_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(OLLAMA_PORT);
    Ok("OLLAMA stopped".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let state = BackendState {
                process: Mutex::new(None),
            };
            let config_path = get_config_path_from_app(&app.handle());
            if let Ok(Some(proc_)) = tauri::async_runtime::block_on(ensure_python_backend_running(config_path)) {
                if let Ok(mut guard) = state.process.lock() {
                    *guard = Some(proc_);
                }
            }
            app.manage(state);

            let ollama_state = OllamaState {
                process: Mutex::new(None),
            };
            app.manage(ollama_state);

            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
                let start_backend_i = MenuItem::with_id(app, "start_backend", "Start Backend", true, None::<&str>)?;
                let stop_backend_i = MenuItem::with_id(app, "stop_backend", "Stop Backend", true, None::<&str>)?;
                let start_ollama_i = MenuItem::with_id(app, "start_ollama", "Start OLLAMA", true, None::<&str>)?;
                let stop_ollama_i = MenuItem::with_id(app, "stop_ollama", "Stop OLLAMA", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[
                    &show_i,
                    &start_backend_i,
                    &stop_backend_i,
                    &start_ollama_i,
                    &stop_ollama_i,
                    &quit_i,
                ])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(move |app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.unminimize();
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "start_backend" => {
                                let app = app.clone();
                                let cfg_path = get_config_path_from_app(&app);
                                tauri::async_runtime::spawn(async move {
                                    if let Ok(Some(proc_)) = ensure_python_backend_running(cfg_path).await {
                                        if let Some(backend) = app.try_state::<BackendState>() {
                                            if let Ok(mut g) = backend.process.lock() {
                                                *g = Some(proc_);
                                            }
                                        }
                                    }
                                });
                            }
                            "stop_backend" => {
                                if let Some(backend) = app.try_state::<BackendState>() {
                                    if let Ok(mut g) = backend.process.lock() {
                                        *g = None;
                                    }
                                }
                                kill_process_on_port(get_backend_port_from_env());
                            }
                            "start_ollama" => {
                                let app = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    if is_ollama_running() {
                                        return;
                                    }
                                    if let Ok(child) = Command::new("ollama")
                                        .arg("serve")
                                        .stdout(std::process::Stdio::null())
                                        .stderr(std::process::Stdio::null())
                                        .spawn()
                                    {
                                        if let Some(ollama) = app.try_state::<OllamaState>() {
                                            if let Ok(mut g) = ollama.process.lock() {
                                                *g = Some(child);
                                            }
                                        }
                                    }
                                });
                            }
                            "stop_ollama" => {
                                if let Some(ollama) = app.try_state::<OllamaState>() {
                                    if let Ok(mut g) = ollama.process.lock() {
                                        *g = None;
                                    }
                                }
                                kill_process_on_port(OLLAMA_PORT);
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            upload_document,
            generate_annotations,
            estimate_finetuning_cost,
            submit_finetuning_job,
            get_documents,
            delete_document,
            get_knowledge_points,
            get_knowledge_points_for_graph,
            create_knowledge_point,
            delete_knowledge_points_batch,
            update_knowledge_point_weight,
            update_knowledge_point_excluded,
            add_knowledge_point_keyword,
            remove_knowledge_point_keyword,
            get_knowledge_point_keywords,
            get_finetuning_jobs,
            get_job_logs,
            get_job_status,
            save_api_key,
            get_api_keys,
            save_training_set,
            get_training_set,
            get_training_items,
            save_training_item,
            delete_training_item,
            get_audit_log,
            get_desensitization_log,
            evaluation_generate,
            chat_query,
            get_local_models,
            list_system_dir,
            get_file_icon,
            get_directories,
            create_directory,
            move_document,
            move_directory,
            delete_directory,
            get_mount_points,
            get_mount_point_document_stats,
            get_recent_annotated_files,
            get_mount_point_files,
            update_mount_point_file_meta,
            get_document_summary,
            get_document_preview,
            get_document_summary_by_id,
            get_document_preview_by_id,
            create_mount_point,
            update_mount_point,
            delete_mount_point,
            delete_all_mount_points,
            get_storage_config,
            get_default_storage_paths,
            save_storage_config,
            start_python_backend,
            stop_python_backend,
            start_ollama,
            stop_ollama
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
