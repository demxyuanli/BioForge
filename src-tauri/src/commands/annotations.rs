use std::process::Command;
use crate::backend_url::get_backend_base_url;

#[tauri::command]
pub async fn generate_annotations(
    app: tauri::AppHandle,
    knowledge_points: Vec<String>,
    api_key: String,
    model: String,
    base_url: Option<String>,
    platform: Option<String>,
    candidate_count: Option<i32>,
) -> Result<String, String> {
    let backend_base = get_backend_base_url(&app);
    let kp_json = serde_json::to_string(&knowledge_points).unwrap_or_else(|_| "[]".to_string());
    let kp_escaped = kp_json.replace('\\', "\\\\").replace('"', "\\\"");
    let api_key_escaped = api_key.replace('\\', "\\\\").replace('"', "\\\"");
    let model_escaped = model.replace('\\', "\\\\").replace('"', "\\\"");
    let base_url_val = base_url.unwrap_or_default();
    let base_url_escaped = base_url_val.replace('\\', "\\\\").replace('"', "\\\"");
    let platform_val = platform.unwrap_or_default();
    let platform_escaped = platform_val.replace('\\', "\\\\").replace('"', "\\\"");
    let candidate_count_val = candidate_count.unwrap_or(1).clamp(1, 10);
    let backend_base_escaped = backend_base.replace('\\', "\\\\").replace('"', "\\\"");

    let python_script = format!(
        r#"
import sys
import requests
import json

backend_base = "{}"
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
        backend_base + '/annotations/generate',
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
        backend_base_escaped,
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
