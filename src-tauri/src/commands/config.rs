use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn get_rag_config(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/config/rag", None, None).await
}

#[tauri::command]
pub async fn save_rag_config(app: tauri::AppHandle, config: serde_json::Value) -> Result<String, String> {
    http::backend_json(&app, Method::POST, "/config/rag", None, Some(config)).await
}
