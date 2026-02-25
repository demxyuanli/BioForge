use reqwest::Method;

use crate::commands::http;

#[tauri::command]
pub async fn search_fulltext(app: tauri::AppHandle, query: String) -> Result<String, String> {
    let query_params = vec![("q".to_string(), query)];
    http::backend_json(&app, Method::GET, "/fulltext-search", Some(query_params), None).await
}

#[tauri::command]
pub async fn rebuild_fulltext_index(app: tauri::AppHandle) -> Result<String, String> {
    http::backend_json(&app, Method::POST, "/fulltext-search/rebuild", None, None).await
}
