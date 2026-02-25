use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn save_api_key(app: tauri::AppHandle, platform: String, api_key: String) -> Result<String, String> {
    let payload = serde_json::json!({"platform": platform, "api_key": api_key});
    http::backend_json(&app, Method::POST, "/api-keys", None, Some(payload)).await
}

#[tauri::command]
pub async fn get_api_keys(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/api-keys", None, None).await
}
