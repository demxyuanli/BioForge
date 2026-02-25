use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn get_directories(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/directories", None, None).await
}

#[tauri::command]
pub async fn create_directory(app: tauri::AppHandle, name: String, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "name": name,
        "parent_id": parent_id
    });
    http::backend_json(&app, Method::POST, "/directories", None, Some(payload)).await
}

#[tauri::command]
pub async fn move_document(app: tauri::AppHandle, document_id: i32, directory_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "directory_id": directory_id
    });
    let path = format!("/documents/{}/move", document_id);
    http::backend_json(&app, Method::PUT, &path, None, Some(payload)).await
}

#[tauri::command]
pub async fn move_directory(app: tauri::AppHandle, directory_id: i32, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "parent_id": parent_id
    });
    let path = format!("/directories/{}/move", directory_id);
    http::backend_json(&app, Method::PUT, &path, None, Some(payload)).await
}

#[tauri::command]
pub async fn delete_directory(app: tauri::AppHandle, directory_id: i32) -> Result<String, String> {
    let path = format!("/directories/{}", directory_id);
    http::backend_json(&app, Method::DELETE, &path, None, None).await
}
