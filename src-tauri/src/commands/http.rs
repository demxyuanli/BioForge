use std::fs;
use std::path::Path;

use base64::Engine;
use reqwest::Method;
use serde_json::Value;

use crate::backend_url::get_backend_base_url;

fn json_result(success: bool, data: Value, error: Option<String>) -> Result<String, String> {
    serde_json::to_string(&serde_json::json!({
        "success": success,
        "data": data,
        "error": error
    }))
    .map_err(|e| e.to_string())
}

pub async fn backend_json(
    app: &tauri::AppHandle,
    method: Method,
    path: &str,
    query: Option<Vec<(String, String)>>,
    body: Option<Value>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(app);
    let url = format!("{}{}", base_url, path);
    let client = reqwest::Client::new();
    let mut req = client.request(method.clone(), &url);
    if let Some(ref q) = query {
        req = req.query(&q);
    }
    if let Some(ref b) = body {
        req = req.json(&b);
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(_) => {
            std::thread::sleep(std::time::Duration::from_millis(300));
            let mut retry = client.request(method, &url);
            if let Some(q) = query.clone() {
                retry = retry.query(&q);
            }
            if let Some(b) = body.clone() {
                retry = retry.json(&b);
            }
            retry
                .send()
                .await
                .map_err(|e| format!("Backend request failed (url: {}): {}", url, e))?
        }
    };
    let status_ok = resp.status().is_success();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if status_ok {
        let data = serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null);
        json_result(true, data, None)
    } else {
        let error = String::from_utf8_lossy(&bytes).to_string();
        json_result(false, Value::Null, Some(error))
    }
}

pub async fn backend_upload_file(
    app: &tauri::AppHandle,
    path: &str,
    file_path: &str,
) -> Result<String, String> {
    let p = Path::new(file_path);
    if !p.exists() {
        return json_result(false, Value::Null, Some("File not found".to_string()));
    }
    let filename = p
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?
        .to_string();
    let bytes = fs::read(p).map_err(|e| format!("Failed to read file: {}", e))?;

    let build_form = || -> Result<reqwest::multipart::Form, String> {
        let part = reqwest::multipart::Part::bytes(bytes.clone())
            .file_name(filename.clone())
            .mime_str("application/octet-stream")
            .map_err(|e| format!("Failed to prepare upload: {}", e))?;
        Ok(reqwest::multipart::Form::new().part("file", part))
    };

    let base_url = get_backend_base_url(app);
    let url = format!("{}{}", base_url, path);
    let client = reqwest::Client::new();
    let resp = match client
        .post(url.clone())
        .multipart(build_form()?)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            std::thread::sleep(std::time::Duration::from_millis(300));
            client
                .post(&url)
                .multipart(build_form()?)
                .send()
                .await
                .map_err(|e| format!("Backend upload failed (url: {}): {}", url, e))?
        }
    };

    let status_ok = resp.status().is_success();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    if status_ok {
        let data = serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null);
        json_result(true, data, None)
    } else {
        let error = String::from_utf8_lossy(&bytes).to_string();
        json_result(false, Value::Null, Some(error))
    }
}

pub async fn backend_binary_with_version(
    app: &tauri::AppHandle,
    path: &str,
    query: Vec<(String, String)>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(app);
    let url = format!("{}{}", base_url, path);
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .query(&query)
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;
    let status_ok = resp.status().is_success();
    if !status_ok {
        let error = resp
            .text()
            .await
            .unwrap_or_else(|e| format!("Failed to read error body: {}", e));
        return json_result(false, Value::Null, Some(error));
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
