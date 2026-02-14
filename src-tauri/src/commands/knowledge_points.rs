use std::process::Command;
use crate::backend_url::get_backend_base_url;

const GRAPH_PAGE_SIZE: i32 = 500;

#[tauri::command]
pub async fn get_knowledge_points(
    app: tauri::AppHandle,
    page: Option<i32>,
    page_size: Option<i32>,
    document_id: Option<i32>,
    min_weight: Option<f64>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let page_val = page.unwrap_or(1);
    let page_size_val = page_size.unwrap_or(50);
    let mut url = format!("{}/documents/knowledge-points?page={}&page_size={}", base_url, page_val, page_size_val);
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
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_knowledge_points_for_graph(
    app: tauri::AppHandle,
    page: Option<i32>,
    min_weight: Option<f64>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let page_val = page.unwrap_or(1);
    let min_val = min_weight.unwrap_or(1.0);
    let min_val = if min_val < 1.0 {
        1.0
    } else if min_val > 5.0 {
        5.0
    } else {
        min_val
    };
    let url = format!(
        "{}/documents/knowledge-points?page={}&page_size={}&min_weight={}",
        base_url,
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
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn delete_knowledge_points_batch(app: tauri::AppHandle, ids: Vec<i32>) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let ids_json = serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_string());
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
ids = json.loads('{}')
try:
    response = requests.delete(base_url + '/documents/knowledge-points/batch', json={{"ids": ids}})
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
        base_escaped,
        ids_json.replace('\\', "\\\\").replace('\'', "\\'")
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn update_knowledge_point_weight(
    app: tauri::AppHandle,
    kp_id: i32,
    weight: f64,
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
    response = requests.patch(base_url + '/documents/knowledge-points/{}', json={{ "weight": {} }})
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
        base_escaped,
        kp_id,
        weight
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn update_knowledge_point_excluded(
    app: tauri::AppHandle,
    kp_id: i32,
    excluded: bool,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let excluded_str = if excluded { "True" } else { "False" };
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.patch(base_url + '/documents/knowledge-points/{}/excluded', json={{ "excluded": {} }})
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
        base_escaped,
        kp_id,
        excluded_str
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn add_knowledge_point_keyword(
    app: tauri::AppHandle,
    kp_id: i32,
    keyword: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let kw_json = serde_json::to_string(&keyword).unwrap();
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.post(base_url + '/documents/knowledge-points/{}/keywords', json={{ "keyword": {} }})
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
        base_escaped,
        kp_id,
        kw_json
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn remove_knowledge_point_keyword(
    app: tauri::AppHandle,
    kp_id: i32,
    keyword: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let kw_json = serde_json::to_string(&keyword).unwrap();
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.delete(base_url + '/documents/knowledge-points/{}/keywords', json={{ "keyword": {} }})
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
        base_escaped,
        kp_id,
        kw_json
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_knowledge_point_keywords(app: tauri::AppHandle, kp_id: i32) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let python_script = format!(
        r#"
import sys
import requests
import json

base_url = "{}"
try:
    response = requests.get(base_url + '/documents/knowledge-points/{}/keywords')
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
        base_escaped,
        kp_id
    );
    let output = Command::new("python")
        .arg("-c")
        .arg(&python_script)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn create_knowledge_point(
    app: tauri::AppHandle,
    document_id: i32,
    content: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let base_escaped = base_url.replace('\\', "\\\\").replace('"', "\\\"");
    let payload = serde_json::json!({
        "document_id": document_id,
        "content": content
    });
    let payload_str = payload.to_string();
    let python_script = format!(
        r#"
import sys
import requests
import json
base_url = "{}"
try:
    payload = json.loads(sys.argv[1])
    response = requests.post(base_url + '/documents/knowledge-points', json=payload)
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
