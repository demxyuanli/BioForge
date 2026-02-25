use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn chat_query(
    app: tauri::AppHandle,
    query: String,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "query": query,
        "api_key": api_key.unwrap_or_default(),
        "model": model.unwrap_or("deepseek-chat".to_string()),
        "base_url": base_url.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    http::backend_json(&app, Method::POST, "/chat/query", None, Some(payload)).await
}
