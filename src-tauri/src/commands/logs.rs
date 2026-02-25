use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn get_audit_log(app: tauri::AppHandle, limit: i32) -> Result<String, String> {
    let query = vec![("limit".to_string(), limit.to_string())];
    http::backend_json(&app, Method::GET, "/audit-log", Some(query), None).await
}

#[tauri::command]
pub async fn get_desensitization_log(app: tauri::AppHandle, limit: i32) -> Result<String, String> {
    let query = vec![("limit".to_string(), limit.to_string())];
    http::backend_json(&app, Method::GET, "/desensitization-log", Some(query), None).await
}
