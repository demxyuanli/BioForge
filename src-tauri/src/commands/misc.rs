use std::fs;

use crate::backend_url::get_backend_base_url;
use crate::commands::http;

#[tauri::command]
pub fn write_export_file(file_path: String, contents_base64: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&contents_base64)
        .map_err(|e| e.to_string())?;
    fs::write(&file_path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_template_file(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext.to_lowercase() != "md" {
        return Err("Only .md files are allowed".to_string());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_system_dir(path: String) -> Result<String, String> {
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
                    return if a_dir {
                        std::cmp::Ordering::Less
                    } else {
                        std::cmp::Ordering::Greater
                    };
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
pub async fn get_file_icon(file_path: String) -> Result<Option<String>, String> {
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
pub async fn get_local_models(app: tauri::AppHandle, base_url: Option<String>) -> Result<String, String> {
    let target_base = base_url.unwrap_or("http://localhost:11434".to_string());
    let backend_base = get_backend_base_url(&app);
    let url = format!("{}/models/local", backend_base);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .query(&[("base_url".to_string(), target_base)])
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;
    let status_ok = resp.status().as_u16() == 200;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    if status_ok {
        let data = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap_or(serde_json::Value::Null);
        http::json_result(true, data, None)
    } else {
        let error = String::from_utf8_lossy(&bytes).to_string();
        http::json_result(false, serde_json::Value::Null, Some(error))
    }
}
