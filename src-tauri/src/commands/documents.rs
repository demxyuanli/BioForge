use std::process::Command;
use crate::backend_url::get_backend_base_url;

#[tauri::command]
pub async fn upload_document(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let python_script = format!(
        r#"
import sys
import requests
import json
import os

file_path = r"{}"
base_url = "{}"

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
        response = requests.post(base_url + '/documents/upload', files=files)
    
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
        file_path.replace('\\', "\\\\"),
        base_url.replace('\\', "\\\\").replace('"', "\\\"")
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
pub async fn get_documents(app: tauri::AppHandle) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.get(base_url + '/documents')
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
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(output_str.to_string())
}

#[tauri::command]
pub async fn delete_document(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
document_id = {}

try:
    response = requests.delete(base_url + '/documents/{{}}'.format(document_id))
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
pub async fn get_document_summary_by_id(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    r = requests.get(base_url + '/documents/{}/summary')
    out = {{"success": r.status_code == 200, "data": r.json() if r.status_code == 200 else None, "error": None if r.status_code == 200 else r.text}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped,
        document_id
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_document_preview_by_id(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json
import base64
base_url = "{}"
try:
    r = requests.get(base_url + '/documents/{}/preview')
    if r.status_code != 200:
        out = {{"success": False, "data": None, "version": "", "error": r.text}}
    else:
        ver = r.headers.get("X-Preview-Version") or r.headers.get("x-preview-version") or ""
        out = {{"success": True, "data": base64.b64encode(r.content).decode(), "version": ver if isinstance(ver, str) else "", "error": None}}
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({{"success": False, "data": None, "error": str(e)}}))
"#,
        base_escaped,
        document_id
    );
    let output = Command::new("python").arg("-c").arg(&python_script).output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
