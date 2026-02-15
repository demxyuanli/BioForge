use reqwest::Method;

use crate::commands::http::backend_json;

#[tauri::command]
pub async fn estimate_finetuning_cost(
    app: tauri::AppHandle,
    dataset_size: i32,
    model: String,
    platform: String,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "dataset_size": dataset_size,
        "model": model,
        "platform": platform
    });
    backend_json(&app, Method::POST, "/finetuning/estimate", None, Some(payload)).await
}

#[tauri::command]
pub async fn submit_finetuning_job(
    app: tauri::AppHandle,
    annotations: Vec<serde_json::Value>,
    platform: String,
    model: String,
    api_key: String,
    format_type: String,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "training_data": {
            "annotations": annotations,
            "format_type": format_type
        },
        "platform": platform,
        "model": model,
        "api_key": api_key
    });
    backend_json(&app, Method::POST, "/finetuning/submit", None, Some(payload)).await
}

#[tauri::command]
pub async fn get_finetuning_jobs(app: tauri::AppHandle) -> Result<String, String> {
    backend_json(&app, Method::GET, "/finetuning/jobs", None, None).await
}

#[tauri::command]
pub async fn get_job_logs(
    app: tauri::AppHandle,
    job_id: String,
    limit: i32,
) -> Result<String, String> {
    let path = format!("/finetuning/jobs/{}/logs", job_id);
    let query = vec![("limit".to_string(), limit.to_string())];
    backend_json(&app, Method::GET, &path, Some(query), None).await
}

#[tauri::command]
pub async fn get_job_status(app: tauri::AppHandle, job_id: String) -> Result<String, String> {
    let path = format!("/finetuning/jobs/{}/status", job_id);
    backend_json(&app, Method::GET, &path, None, None).await
}
