use std::fs;
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use crate::backend_url::get_backend_base_url;

#[tauri::command]
pub async fn estimate_finetuning_cost(
    app: tauri::AppHandle,
    dataset_size: i32,
    model: String,
    platform: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.post(
        base_url + '/finetuning/estimate',
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
        base_escaped,
        dataset_size,
        model,
        platform
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn submit_finetuning_job(
    app: tauri::AppHandle,
    annotations: Vec<serde_json::Value>,
    platform: String,
    model: String,
    api_key: String,
    format_type: String,
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
        .map(|d: Duration| d.as_millis())
        .unwrap_or(0);
    let payload_path = std::env::temp_dir().join(format!(
        "bioforger_finetune_submit_{}_{}.json",
        std::process::id(),
        ts
    ));
    fs::write(&payload_path, payload_str).map_err(|e| format!("Failed to write temp payload: {}", e))?;

    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    payload_path = sys.argv[1]
    with open(payload_path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    response = requests.post(
        base_url + '/finetuning/submit',
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
        base_escaped
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .arg(payload_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| {
            let _ = fs::remove_file(&payload_path);
            format!("Failed to execute Python: {}", e)
        })?;
    let _ = fs::remove_file(&payload_path);
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_finetuning_jobs(app: tauri::AppHandle) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.get(base_url + '/finetuning/jobs')
    result = {{"success": response.status_code == 200, "data": response.json() if response.status_code == 200 else None, "error": None if response.status_code == 200 else response.text}}
    print(json.dumps(result))
except Exception as e:
    result = {{"success": False, "data": None, "error": str(e)}}
    print(json.dumps(result))
"#,
        base_escaped
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_job_logs(
    app: tauri::AppHandle,
    job_id: String,
    limit: i32,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
job_id = "{}"
limit = {}

try:
    response = requests.get(base_url + '/finetuning/jobs/{{}}/logs?limit={{}}'.format(job_id, limit))
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
        base_escaped,
        job_id,
        limit
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_job_status(app: tauri::AppHandle, job_id: String) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
job_id = "{}"

try:
    response = requests.get(base_url + '/finetuning/jobs/{{}}/status'.format(job_id))
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
        base_escaped,
        job_id
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
