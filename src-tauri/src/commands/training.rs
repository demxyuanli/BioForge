use reqwest::Method;

use crate::commands::http::backend_json;

#[tauri::command]
pub async fn save_training_set(
    app: tauri::AppHandle,
    annotations: Vec<serde_json::Value>,
    training_item_id: Option<i32>,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "annotations": annotations,
        "training_item_id": training_item_id
    });
    backend_json(&app, Method::POST, "/training-set", None, Some(payload)).await
}

#[tauri::command]
pub async fn get_training_set(
    app: tauri::AppHandle,
    training_item_id: Option<i32>,
) -> Result<String, String> {
    let query = training_item_id
        .map(|v| vec![("training_item_id".to_string(), v.to_string())]);
    backend_json(&app, Method::GET, "/training-set", query, None).await
}

#[tauri::command]
pub async fn get_training_items(app: tauri::AppHandle) -> Result<String, String> {
    backend_json(&app, Method::GET, "/training-items", None, None).await
}

#[tauri::command]
pub async fn save_training_item(
    app: tauri::AppHandle,
    name: String,
    knowledge_point_keys: Vec<String>,
    prompt_template: String,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "name": name,
        "knowledge_point_keys": knowledge_point_keys,
        "prompt_template": prompt_template
    });
    backend_json(&app, Method::POST, "/training-items", None, Some(payload)).await
}

#[tauri::command]
pub async fn delete_training_item(app: tauri::AppHandle, item_id: i32) -> Result<String, String> {
    let path = format!("/training-items/{}", item_id);
    backend_json(&app, Method::DELETE, &path, None, None).await
}
