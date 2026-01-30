// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::Command;
use std::path::PathBuf;
use std::time::Duration;

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
async fn generate_annotations(knowledge_points: Vec<String>, api_key: String, model: String) -> Result<String, String> {
    let kp_json = serde_json::to_string(&knowledge_points).unwrap_or_else(|_| "[]".to_string());
    let kp_escaped = kp_json.replace('\\', "\\\\").replace('"', "\\\"");
    let api_key_escaped = api_key.replace('\\', "\\\\").replace('"', "\\\"");
    let model_escaped = model.replace('\\', "\\\\").replace('"', "\\\"");

    let python_script = format!(
        r#"
import sys
import requests
import json

kp_json = "{}"
knowledge_points = json.loads(kp_json) if kp_json else []
api_key = "{}"
model = "{}"

try:
    response = requests.post(
        'http://127.0.0.1:8778/annotations/generate',
        json={{
            "knowledge_points": knowledge_points,
            "api_key": api_key,
            "model": model
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
        kp_escaped,
        api_key_escaped,
        model_escaped
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
    let python_script = format!(
        r#"
import sys
import requests
import json

annotations = {}
platform = "{}"
model = "{}"
api_key = "{}"
format_type = "{}"

try:
    response = requests.post(
        'http://127.0.0.1:8778/finetuning/submit',
        json={{
            "training_data": {{
                "annotations": annotations,
                "format_type": format_type
            }},
            "platform": platform,
            "model": model,
            "api_key": api_key
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
        serde_json::to_string(&annotations).unwrap(),
        platform, model, api_key, format_type
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
async fn get_knowledge_points() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json

try:
    response = requests.get('http://127.0.0.1:8778/documents/knowledge-points')
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
async fn save_training_set(annotations: Vec<serde_json::Value>) -> Result<String, String> {
    let annotations_str = serde_json::to_string(&annotations).unwrap_or_else(|_| "[]".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json
try:
    annotations = {}
    r = requests.post('http://127.0.0.1:8778/training-set', json={{"annotations": annotations}})
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        annotations_str
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn get_training_set() -> Result<String, String> {
    let python_script = r#"
import sys
import requests
import json
try:
    r = requests.get('http://127.0.0.1:8778/training-set')
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
async fn evaluation_generate(prompt: String, template: String, api_key: Option<String>) -> Result<String, String> {
    let payload = serde_json::json!({
        "prompt": prompt,
        "template": template,
        "api_key": api_key.unwrap_or_default()
    });
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
async fn start_python_backend() -> Result<String, String> {
    const BACKEND_PORT: u16 = 8778;
    let health_url = format!("http://127.0.0.1:{}/health", BACKEND_PORT);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    if let Ok(resp) = client.get(&health_url).send().await {
        if resp.status().is_success() {
            return Ok("Python backend already running".to_string());
        }
    }

    let mut python_path: Option<PathBuf> = None;

    // First try current directory (development)
    if let Ok(current_dir) = std::env::current_dir() {
        let dev_path = current_dir.join("python-backend").join("main.py");
        if dev_path.exists() {
            python_path = Some(dev_path);
        } else {
            // Try parent directory (if running from src-tauri)
            if let Some(parent_dir) = current_dir.parent() {
                let parent_path = parent_dir.join("python-backend").join("main.py");
                if parent_path.exists() {
                    python_path = Some(parent_path);
                }
            }
        }
    }

    // If not found, try executable directory (production)
    if python_path.is_none() {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let prod_path = exe_dir.join("python-backend").join("main.py");
                if prod_path.exists() {
                    python_path = Some(prod_path);
                }
            }
        }
    }

    let python_path = python_path.ok_or("Python backend main.py not found. Please ensure python-backend/main.py exists.")?;

    let backend_dir = python_path.parent()
        .ok_or("Invalid path")?
        .to_path_buf();

    Command::new("python")
        .arg(python_path.to_str().ok_or("Invalid path")?)
        .current_dir(&backend_dir)
        .spawn()
        .map_err(|e| format!("Failed to start Python backend: {}", e))?;

    Ok("Python backend started".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            upload_document,
            generate_annotations,
            estimate_finetuning_cost,
            submit_finetuning_job,
            get_documents,
            delete_document,
            get_knowledge_points,
            get_finetuning_jobs,
            get_job_logs,
            get_job_status,
            save_api_key,
            get_api_keys,
            save_training_set,
            get_training_set,
            get_audit_log,
            get_desensitization_log,
            evaluation_generate,
            start_python_backend
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
