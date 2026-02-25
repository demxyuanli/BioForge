use base64::Engine;
use reqwest::Method;

use crate::backend_url::get_backend_base_url;
use crate::commands::http;

#[tauri::command]
pub async fn get_mount_points(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/mount-points", None, None).await
}

#[tauri::command]
pub async fn create_mount_point(
    app: tauri::AppHandle,
    path: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "path": path,
        "name": name.unwrap_or_default(),
        "description": description.unwrap_or_default()
    });
    http::backend_json(&app, Method::POST, "/mount-points", None, Some(payload)).await
}

#[tauri::command]
pub async fn update_mount_point(
    app: tauri::AppHandle,
    mp_id: i32,
    path: Option<String>,
    name: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    if let Some(p) = path {
        payload.insert("path".to_string(), serde_json::json!(p));
    }
    if let Some(n) = name {
        payload.insert("name".to_string(), serde_json::json!(n));
    }
    if let Some(d) = description {
        payload.insert("description".to_string(), serde_json::json!(d));
    }
    let path_str = format!("/mount-points/{}", mp_id);
    http::backend_json(
        &app,
        Method::PATCH,
        &path_str,
        None,
        Some(serde_json::Value::Object(payload)),
    )
    .await
}

#[tauri::command]
pub async fn get_mount_point_document_stats(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}/document-stats", mp_id);
    http::backend_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
pub async fn get_recent_annotated_files(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::GET, "/mount-points/recent-annotated-files", None, None).await
}

#[tauri::command]
pub async fn get_mount_point_files(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}/files", mp_id);
    http::backend_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
pub async fn update_mount_point_file_meta(
    app: tauri::AppHandle,
    mp_id: i32,
    relative_path: String,
    weight: Option<f64>,
    note: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    payload.insert("relative_path".to_string(), serde_json::json!(relative_path));
    if let Some(w) = weight {
        payload.insert("weight".to_string(), serde_json::json!(w));
    }
    if let Some(n) = note {
        payload.insert("note".to_string(), serde_json::json!(n));
    }
    let path = format!("/mount-points/{}/files/meta", mp_id);
    http::backend_json(&app, Method::PATCH, &path, None, Some(serde_json::Value::Object(payload))).await
}

#[tauri::command]
pub async fn get_document_summary(
    app: tauri::AppHandle,
    mp_id: i32,
    relative_path: String,
) -> Result<String, String> {
    let query = vec![
        ("mp_id".to_string(), mp_id.to_string()),
        ("relative_path".to_string(), relative_path),
    ];
    http::backend_json(&app, Method::GET, "/mount-points/document-summary", Some(query), None).await
}

#[tauri::command]
pub async fn get_document_preview(
    app: tauri::AppHandle,
    mp_id: i32,
    relative_path: String,
) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let url = format!("{}/mount-points/document-preview", base_url);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .query(&[
            ("mp_id".to_string(), mp_id.to_string()),
            ("relative_path".to_string(), relative_path),
        ])
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;
    let status_ok = resp.status().as_u16() == 200;
    if !status_ok {
        let error = resp
            .text()
            .await
            .unwrap_or_else(|e| format!("Failed to read error body: {}", e));
        return http::json_result(false, serde_json::Value::Null, Some(error));
    }
    let version = resp
        .headers()
        .get("X-Preview-Version")
        .or_else(|| resp.headers().get("x-preview-version"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    serde_json::to_string(&serde_json::json!({
        "success": true,
        "data": encoded,
        "version": version,
        "error": null
    }))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_mount_point(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}", mp_id);
    http::backend_json(&app, Method::DELETE, &path, None, None).await
}

#[tauri::command]
pub async fn delete_all_mount_points(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::DELETE, "/mount-points", None, None).await
}
