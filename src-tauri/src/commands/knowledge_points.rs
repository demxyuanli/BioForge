use reqwest::Method;

use crate::commands::http::backend_json;

const GRAPH_PAGE_SIZE: i32 = 500;

#[tauri::command]
pub async fn get_knowledge_points(
    app: tauri::AppHandle,
    page: Option<i32>,
    page_size: Option<i32>,
    document_id: Option<i32>,
    min_weight: Option<f64>,
) -> Result<String, String> {
    let mut query = vec![
        ("page".to_string(), page.unwrap_or(1).to_string()),
        ("page_size".to_string(), page_size.unwrap_or(50).to_string()),
    ];
    if let Some(doc_id) = document_id {
        query.push(("document_id".to_string(), doc_id.to_string()));
    }
    if let Some(w) = min_weight {
        query.push(("min_weight".to_string(), w.to_string()));
    }
    backend_json(
        &app,
        Method::GET,
        "/documents/knowledge-points",
        Some(query),
        None,
    )
    .await
}

#[tauri::command]
pub async fn get_knowledge_points_for_graph(
    app: tauri::AppHandle,
    page: Option<i32>,
    min_weight: Option<f64>,
) -> Result<String, String> {
    let mut min_val = min_weight.unwrap_or(1.0);
    min_val = min_val.clamp(1.0, 5.0);
    let query = vec![
        ("page".to_string(), page.unwrap_or(1).to_string()),
        ("page_size".to_string(), GRAPH_PAGE_SIZE.to_string()),
        ("min_weight".to_string(), min_val.to_string()),
    ];
    backend_json(
        &app,
        Method::GET,
        "/documents/knowledge-points",
        Some(query),
        None,
    )
    .await
}

#[tauri::command]
pub async fn delete_knowledge_points_batch(app: tauri::AppHandle, ids: Vec<i32>) -> Result<String, String> {
    let payload = serde_json::json!({ "ids": ids });
    backend_json(
        &app,
        Method::DELETE,
        "/documents/knowledge-points/batch",
        None,
        Some(payload),
    )
    .await
}

#[tauri::command]
pub async fn update_knowledge_point_weight(
    app: tauri::AppHandle,
    kp_id: i32,
    weight: f64,
) -> Result<String, String> {
    let path = format!("/documents/knowledge-points/{}", kp_id);
    backend_json(
        &app,
        Method::PATCH,
        &path,
        None,
        Some(serde_json::json!({ "weight": weight })),
    )
    .await
}

#[tauri::command]
pub async fn update_knowledge_point_excluded(
    app: tauri::AppHandle,
    kp_id: i32,
    excluded: bool,
) -> Result<String, String> {
    let path = format!("/documents/knowledge-points/{}/excluded", kp_id);
    backend_json(
        &app,
        Method::PATCH,
        &path,
        None,
        Some(serde_json::json!({ "excluded": excluded })),
    )
    .await
}

#[tauri::command]
pub async fn add_knowledge_point_keyword(
    app: tauri::AppHandle,
    kp_id: i32,
    keyword: String,
) -> Result<String, String> {
    let path = format!("/documents/knowledge-points/{}/keywords", kp_id);
    backend_json(
        &app,
        Method::POST,
        &path,
        None,
        Some(serde_json::json!({ "keyword": keyword })),
    )
    .await
}

#[tauri::command]
pub async fn remove_knowledge_point_keyword(
    app: tauri::AppHandle,
    kp_id: i32,
    keyword: String,
) -> Result<String, String> {
    let path = format!("/documents/knowledge-points/{}/keywords", kp_id);
    backend_json(
        &app,
        Method::DELETE,
        &path,
        None,
        Some(serde_json::json!({ "keyword": keyword })),
    )
    .await
}

#[tauri::command]
pub async fn get_knowledge_point_keywords(app: tauri::AppHandle, kp_id: i32) -> Result<String, String> {
    let path = format!("/documents/knowledge-points/{}/keywords", kp_id);
    backend_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
pub async fn create_knowledge_point(
    app: tauri::AppHandle,
    document_id: i32,
    content: String,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "document_id": document_id,
        "content": content
    });
    backend_json(
        &app,
        Method::POST,
        "/documents/knowledge-points",
        None,
        Some(payload),
    )
    .await
}
