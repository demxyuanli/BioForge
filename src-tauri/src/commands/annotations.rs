use reqwest::Method;

use crate::commands::http::backend_json;

#[tauri::command]
pub async fn generate_annotations(
    app: tauri::AppHandle,
    knowledge_points: Vec<String>,
    api_key: String,
    model: String,
    base_url: Option<String>,
    platform: Option<String>,
    candidate_count: Option<i32>,
    skill_ids: Option<Vec<i32>>,
) -> Result<String, String> {
    let base_url_val = base_url.unwrap_or_default();
    let platform_val = platform.unwrap_or_default();
    let candidate_count_val = candidate_count.unwrap_or(1).clamp(1, 10);
    let mut payload = serde_json::json!({
        "knowledge_points": knowledge_points,
        "api_key": api_key,
        "model": model,
        "candidate_count": candidate_count_val
    });
    if !base_url_val.is_empty() {
        payload["base_url"] = serde_json::json!(base_url_val);
    }
    if !platform_val.is_empty() {
        payload["platform"] = serde_json::json!(platform_val);
    }
    if let Some(ids) = skill_ids {
        if !ids.is_empty() {
            payload["skill_ids"] = serde_json::json!(ids);
        }
    }

    backend_json(&app, Method::POST, "/annotations/generate", None, Some(payload)).await
}
