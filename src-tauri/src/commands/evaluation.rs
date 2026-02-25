use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn evaluation_generate(
    app: tauri::AppHandle,
    prompt: String,
    template: String,
    api_key: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "prompt": prompt,
        "template": template,
        "api_key": api_key.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    http::backend_json(&app, Method::POST, "/evaluation/generate", None, Some(payload)).await
}
