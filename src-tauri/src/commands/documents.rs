use reqwest::Method;

use crate::commands::http::{backend_binary_with_version, backend_json, backend_upload_file};

#[tauri::command]
pub async fn upload_document(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    backend_upload_file(&app, "/documents/upload", &file_path).await
}

#[tauri::command]
pub async fn get_documents(app: tauri::AppHandle) -> Result<String, String> {
    backend_json(&app, Method::GET, "/documents", None, None).await
}

#[tauri::command]
pub async fn delete_document(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let path = format!("/documents/{}", document_id);
    backend_json(&app, Method::DELETE, &path, None, None).await
}

#[tauri::command]
pub async fn get_document_summary_by_id(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let path = format!("/documents/{}/summary", document_id);
    backend_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
pub async fn get_document_preview_by_id(app: tauri::AppHandle, document_id: i32) -> Result<String, String> {
    let path = format!("/documents/{}/preview", document_id);
    backend_binary_with_version(&app, &path, vec![]).await
}
