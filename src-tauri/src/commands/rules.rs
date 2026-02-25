use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn get_rules(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/rules", None, None).await
}

#[tauri::command]
pub async fn create_rule(app: tauri::AppHandle, body: serde_json::Value) -> Result<String, String> {
    let payload = if body.is_object() { body } else { serde_json::json!({}) };
    http::backend_json(&app, Method::POST, "/rules", None, Some(payload)).await
}

#[tauri::command]
pub async fn update_rule(app: tauri::AppHandle, rule_id: i32, body: serde_json::Value) -> Result<String, String> {
    let path = format!("/rules/{}", rule_id);
    let payload = if body.is_object() { body } else { serde_json::json!({}) };
    http::backend_json(&app, Method::PATCH, &path, None, Some(payload)).await
}

#[tauri::command]
pub async fn delete_rule(app: tauri::AppHandle, rule_id: i32) -> Result<String, String> {
    let path = format!("/rules/{}", rule_id);
    http::backend_json(&app, Method::DELETE, &path, None, None).await
}
