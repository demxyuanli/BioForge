use std::process::Command;
use crate::backend_url::get_backend_base_url;

#[tauri::command]
pub async fn save_training_set(
    app: tauri::AppHandle,
    annotations: Vec<serde_json::Value>,
    training_item_id: Option<i32>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let payload = serde_json::json!({
        "annotations": annotations,
        "training_item_id": training_item_id
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    payload = json.loads(sys.argv[1])
    r = requests.post(base_url + '/training-set', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .arg(&payload_str)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_training_set(
    app: tauri::AppHandle,
    training_item_id: Option<i32>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let training_item_id_val = training_item_id
        .map(|v| v.to_string())
        .unwrap_or_else(|| "".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    params = {{}}
    training_item_id = "{}"
    if training_item_id:
        params["training_item_id"] = training_item_id
    r = requests.get(base_url + '/training-set', params=params)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped,
        training_item_id_val
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_training_items(app: tauri::AppHandle) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    r = requests.get(base_url + '/training-items')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
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
pub async fn save_training_item(
    app: tauri::AppHandle,
    name: String,
    knowledge_point_keys: Vec<String>,
    prompt_template: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let payload = serde_json::json!({
        "name": name,
        "knowledge_point_keys": knowledge_point_keys,
        "prompt_template": prompt_template
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    payload = json.loads(sys.argv[1])
    r = requests.post(base_url + '/training-items', json=payload)
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .arg(&payload_str)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn delete_training_item(app: tauri::AppHandle, item_id: i32) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    r = requests.delete(base_url + '/training-items/{}')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped,
        item_id
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
