// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod backend_url;
mod state;
mod commands;

use std::process::Command;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use std::fs;
use reqwest::Method;
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use backend_url::{
    get_backend_base_url, get_config_path_from_app, get_backend_port_from_env,
    BACKEND_PORT_CONFIG_KEY,
};
use state::{BackendProcess, BackendState, OllamaState};
#[cfg(windows)]
use state::JobHandleGuard;
use commands::documents::{
    upload_document, get_documents, delete_document,
    get_document_summary_by_id, get_document_preview_by_id,
};
use commands::annotations::generate_annotations;
use commands::knowledge_points::{
    get_knowledge_points, get_knowledge_points_for_graph,
    delete_knowledge_points_batch, update_knowledge_point_weight, update_knowledge_point_excluded,
    add_knowledge_point_keyword, remove_knowledge_point_keyword, get_knowledge_point_keywords,
    create_knowledge_point,
};
use commands::finetuning::{
    estimate_finetuning_cost, submit_finetuning_job,
    get_finetuning_jobs, get_job_logs, get_job_status,
};
use commands::training::{
    save_training_set, get_training_set, get_training_items, save_training_item, delete_training_item,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn backend_host_command() -> Command {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("python");
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(windows))]
    {
        Command::new("python")
    }
}

fn json_result(success: bool, data: serde_json::Value, error: Option<String>) -> Result<String, String> {
    serde_json::to_string(&serde_json::json!({
        "success": success,
        "data": data,
        "error": error
    }))
    .map_err(|e| e.to_string())
}

async fn backend_request_json(
    app: &tauri::AppHandle,
    method: Method,
    path: &str,
    query: Option<Vec<(String, String)>>,
    body: Option<serde_json::Value>,
) -> Result<String, String> {
    let base_url = get_backend_base_url(app);
    let url = format!("{}{}", base_url, path);
    let client = reqwest::Client::new();
    let mut req = client.request(method, &url);
    if let Some(q) = query {
        req = req.query(&q);
    }
    if let Some(b) = body {
        req = req.json(&b);
    }

    let resp = req.send().await.map_err(|e| format!("Backend request failed: {}", e))?;
    let status_ok = resp.status().as_u16() == 200;
    let bytes = resp.bytes().await.map_err(|e| format!("Failed to read response: {}", e))?;

    if status_ok {
        let data = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap_or(serde_json::Value::Null);
        json_result(true, data, None)
    } else {
        let error = String::from_utf8_lossy(&bytes).to_string();
        json_result(false, serde_json::Value::Null, Some(error))
    }
}

#[tauri::command]
async fn save_api_key(app: tauri::AppHandle, platform: String, api_key: String) -> Result<String, String> {
    let payload = serde_json::json!({"platform": platform, "api_key": api_key});
    backend_request_json(&app, Method::POST, "/api-keys", None, Some(payload)).await
}

#[tauri::command]
async fn get_api_keys(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::GET, "/api-keys", None, None).await
}

#[tauri::command]
async fn get_audit_log(app: tauri::AppHandle, limit: i32) -> Result<String, String> {
    let query = vec![("limit".to_string(), limit.to_string())];
    backend_request_json(&app, Method::GET, "/audit-log", Some(query), None).await
}

#[tauri::command]
async fn get_desensitization_log(app: tauri::AppHandle, limit: i32) -> Result<String, String> {
    let query = vec![("limit".to_string(), limit.to_string())];
    backend_request_json(&app, Method::GET, "/desensitization-log", Some(query), None).await
}

#[tauri::command]
async fn get_rag_config(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::GET, "/config/rag", None, None).await
}

#[tauri::command]
async fn save_rag_config(app: tauri::AppHandle, config: serde_json::Value) -> Result<String, String> {
    backend_request_json(&app, Method::POST, "/config/rag", None, Some(config)).await
}

#[tauri::command]
async fn search_fulltext(app: tauri::AppHandle, query: String) -> Result<String, String> {
    let query_params = vec![("q".to_string(), query)];
    backend_request_json(&app, Method::GET, "/fulltext-search", Some(query_params), None).await
}

#[tauri::command]
async fn rebuild_fulltext_index(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::POST, "/fulltext-search/rebuild", None, None).await
}

#[tauri::command]
fn write_export_file(file_path: String, contents_base64: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&contents_base64)
        .map_err(|e| e.to_string())?;
    fs::write(&file_path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_template_file(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext.to_lowercase() != "md" {
        return Err("Only .md files are allowed".to_string());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn evaluation_generate(
    app: tauri::AppHandle,
    prompt: String,
    template: String,
    api_key: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "prompt": prompt,
        "template": template,
        "api_key": api_key.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    backend_request_json(&app, Method::POST, "/evaluation/generate", None, Some(payload)).await
}

#[tauri::command]
async fn chat_query(
    app: tauri::AppHandle,
    query: String,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    platform: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::json!({
        "query": query,
        "api_key": api_key.unwrap_or_default(),
        "model": model.unwrap_or("deepseek-chat".to_string()),
        "base_url": base_url.unwrap_or_default()
    });
    if let Some(p) = platform {
        payload["platform"] = serde_json::json!(p);
    }
    backend_request_json(&app, Method::POST, "/chat/query", None, Some(payload)).await
}


#[tauri::command]
async fn list_system_dir(path: String) -> Result<String, String> {
    let mut entries = Vec::new();
    match fs::read_dir(&path) {
        Ok(dir) => {
            for entry in dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue;
                }
                let is_dir = entry.metadata().map(|m| m.is_dir()).unwrap_or(false);
                entries.push(serde_json::json!({
                    "name": name,
                    "isDirectory": is_dir
                }));
            }
            entries.sort_by(|a, b| {
                let a_dir = a["isDirectory"].as_bool().unwrap_or(false);
                let b_dir = b["isDirectory"].as_bool().unwrap_or(false);
                if a_dir != b_dir {
                    return if a_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
                }
                let a_name = a["name"].as_str().unwrap_or("");
                let b_name = b["name"].as_str().unwrap_or("");
                a_name.cmp(b_name)
            });
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    Ok(serde_json::to_string(&entries).unwrap_or_else(|_| "[]".to_string()))
}

#[tauri::command]
async fn get_file_icon(file_path: String) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        use windows_icons::get_icon_base64_by_path;
        match get_icon_base64_by_path(&file_path) {
            Ok(base64) => Ok(Some(base64)),
            Err(_) => Ok(None),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = file_path;
        Ok(None)
    }
}

#[tauri::command]
async fn get_directories(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::GET, "/directories", None, None).await
}

#[tauri::command]
async fn create_directory(app: tauri::AppHandle, name: String, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "name": name,
        "parent_id": parent_id
    });
    backend_request_json(&app, Method::POST, "/directories", None, Some(payload)).await
}

#[tauri::command]
async fn move_document(app: tauri::AppHandle, document_id: i32, directory_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "directory_id": directory_id
    });
    let path = format!("/documents/{}/move", document_id);
    backend_request_json(&app, Method::PUT, &path, None, Some(payload)).await
}

#[tauri::command]
async fn move_directory(app: tauri::AppHandle, directory_id: i32, parent_id: Option<i32>) -> Result<String, String> {
    let payload = serde_json::json!({
        "parent_id": parent_id
    });
    let path = format!("/directories/{}/move", directory_id);
    backend_request_json(&app, Method::PUT, &path, None, Some(payload)).await
}

#[tauri::command]
async fn delete_all_mount_points(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::DELETE, "/mount-points", None, None).await
}

#[tauri::command]
async fn get_mount_points(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::GET, "/mount-points", None, None).await
}

#[tauri::command]
async fn create_mount_point(app: tauri::AppHandle, path: String, name: Option<String>, description: Option<String>) -> Result<String, String> {
    let payload = serde_json::json!({
        "path": path,
        "name": name.unwrap_or_default(),
        "description": description.unwrap_or_default()
    });
    backend_request_json(&app, Method::POST, "/mount-points", None, Some(payload)).await
}

#[tauri::command]
async fn update_mount_point(app: tauri::AppHandle, mp_id: i32, path: Option<String>, name: Option<String>, description: Option<String>) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    if let Some(p) = path { payload.insert("path".to_string(), serde_json::json!(p)); }
    if let Some(n) = name { payload.insert("name".to_string(), serde_json::json!(n)); }
    if let Some(d) = description { payload.insert("description".to_string(), serde_json::json!(d)); }
    let path = format!("/mount-points/{}", mp_id);
    backend_request_json(&app, Method::PATCH, &path, None, Some(serde_json::Value::Object(payload))).await
}

#[tauri::command]
async fn get_mount_point_document_stats(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}/document-stats", mp_id);
    backend_request_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
async fn get_recent_annotated_files(app: tauri::AppHandle) -> Result<String, String> {
    backend_request_json(&app, Method::GET, "/mount-points/recent-annotated-files", None, None).await
}

#[tauri::command]
async fn get_mount_point_files(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}/files", mp_id);
    backend_request_json(&app, Method::GET, &path, None, None).await
}

#[tauri::command]
async fn update_mount_point_file_meta(app: tauri::AppHandle, mp_id: i32, relative_path: String, weight: Option<f64>, note: Option<String>) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    payload.insert("relative_path".to_string(), serde_json::json!(relative_path));
    if let Some(w) = weight { payload.insert("weight".to_string(), serde_json::json!(w)); }
    if let Some(n) = note { payload.insert("note".to_string(), serde_json::json!(n)); }
    let path = format!("/mount-points/{}/files/meta", mp_id);
    backend_request_json(&app, Method::PATCH, &path, None, Some(serde_json::Value::Object(payload))).await
}

#[tauri::command]
async fn get_document_summary(app: tauri::AppHandle, mp_id: i32, relative_path: String) -> Result<String, String> {
    let query = vec![
        ("mp_id".to_string(), mp_id.to_string()),
        ("relative_path".to_string(), relative_path),
    ];
    backend_request_json(&app, Method::GET, "/mount-points/document-summary", Some(query), None).await
}

#[tauri::command]
async fn get_document_preview(app: tauri::AppHandle, mp_id: i32, relative_path: String) -> Result<String, String> {
    let base_url = get_backend_base_url(&app);
    let url = format!("{}{}", base_url, "/mount-points/document-preview");
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
        return json_result(false, serde_json::Value::Null, Some(error));
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
    use base64::Engine;
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
async fn delete_mount_point(app: tauri::AppHandle, mp_id: i32) -> Result<String, String> {
    let path = format!("/mount-points/{}", mp_id);
    backend_request_json(&app, Method::DELETE, &path, None, None).await
}

#[tauri::command]
async fn delete_directory(app: tauri::AppHandle, directory_id: i32) -> Result<String, String> {
    let path = format!("/directories/{}", directory_id);
    backend_request_json(&app, Method::DELETE, &path, None, None).await
}

#[tauri::command]
async fn get_local_models(base_url: Option<String>) -> Result<String, String> {
    let target_base = base_url.unwrap_or("http://localhost:11434".to_string());
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8778/models/local")
        .query(&[("base_url".to_string(), target_base)])
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;
    let status_ok = resp.status().as_u16() == 200;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    if status_ok {
        let data = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap_or(serde_json::Value::Null);
        json_result(true, data, None)
    } else {
        let error = String::from_utf8_lossy(&bytes).to_string();
        json_result(false, serde_json::Value::Null, Some(error))
    }
}

#[tauri::command]
fn get_storage_config(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let config_path = backend_url::get_config_path_from_app(&app).ok_or("Config path not found")?;
    backend_url::migrate_config_from_legacy(&config_path);
    if !config_path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    Ok(Some(v))
}

#[tauri::command]
fn get_default_storage_paths() -> Result<serde_json::Value, String> {
    let backend_dir = backend_url::find_main_py_path()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .ok_or("Backend dir not found")?;
    let docs = backend_dir.join("documents");
    let db = backend_dir.join("aiforger.db");
    Ok(serde_json::json!({
        "documentsDir": docs.to_string_lossy(),
        "dbPath": db.to_string_lossy()
    }))
}

#[tauri::command]
fn save_storage_config(app: tauri::AppHandle, documents_dir: String, db_path: String) -> Result<(), String> {
    let config_path = backend_url::get_config_path_from_app(&app).ok_or("Config path not found")?;
    let parent = config_path
        .parent()
        .ok_or("Invalid config path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut config = if config_path.exists() {
        let raw = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !config.is_object() {
        config = serde_json::json!({});
    }
    if let Some(obj) = config.as_object_mut() {
        obj.insert("documentsDir".to_string(), serde_json::json!(documents_dir));
        obj.insert("dbPath".to_string(), serde_json::json!(db_path));
        if !obj.contains_key(BACKEND_PORT_CONFIG_KEY) {
            obj.insert(
                BACKEND_PORT_CONFIG_KEY.to_string(),
                serde_json::json!(get_backend_port_from_env())
            );
        }
    }
    fs::write(config_path, config.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}

const CHAT_HISTORY_FILENAME: &str = "chat-history.json";

#[tauri::command]
fn read_chat_history(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let path = dir.join(CHAT_HISTORY_FILENAME);
    if !path.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_chat_history(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(CHAT_HISTORY_FILENAME);
    fs::write(&path, contents).map_err(|e| e.to_string())
}

fn kill_process_on_port(port: u16) {
    #[cfg(windows)]
    {
        let port_str = format!(":{}", port);
        let output = match Command::new("netstat")
            .args(["-ano"])
            .output()
        {
            Ok(o) => o,
            Err(_) => return,
        };
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains(&port_str) && line.contains("LISTENING") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid_str) = parts.last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        if pid != 0 {
                            let _ = Command::new("taskkill")
                                .args(["/PID", &pid.to_string(), "/F"])
                                .output();
                        }
                    }
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = port;
    }
}

async fn wait_backend_healthy(client: &reqwest::Client, health_url: &str) -> bool {
    for _ in 0..25 {
        if let Ok(resp) = client.get(health_url).send().await {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

async fn ensure_python_backend_running(config_path: Option<PathBuf>) -> Result<Option<BackendProcess>, String> {
    // Prefer Python source (main.py) when present so dev runs use latest code; fall back to packaged exe.
    let main_py_path = backend_url::find_main_py_path();
    let backend_exe_path = backend_url::find_backend_executable_path();
    let (backend_dir, backend_entry_path, use_executable) = if let Some(main_py) = main_py_path {
        let backend_dir = main_py.parent()
            .ok_or("Invalid path")?
            .to_path_buf();
        let gui_host_path = backend_dir.join("backend_gui_host.py");
        let backend_entry_path = if gui_host_path.exists() {
            gui_host_path
        } else {
            main_py
        };
        (backend_dir, backend_entry_path, false)
    } else if let Some(exe_path) = backend_exe_path {
        (
            exe_path
                .parent()
                .ok_or("Invalid backend executable path")?
                .to_path_buf(),
            exe_path,
            true,
        )
    } else {
        return Err("Python backend main.py not found. Please ensure python-backend/main.py exists or build the backend exe.".to_string());
    };
    let backend_port = backend_url::resolve_backend_port(config_path.as_ref());
    backend_url::configure_python_env(&backend_dir, backend_port);
    let health_url = format!("http://127.0.0.1:{}/health", backend_port);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    if let Ok(resp) = client.get(&health_url).send().await {
        if resp.status().is_success() {
            return Ok(None);
        }
    }

    kill_process_on_port(backend_port);
    std::thread::sleep(Duration::from_millis(500));

    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
            JobObjectExtendedLimitInformation, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        };
        use windows::Win32::Foundation::CloseHandle;
        use windows::core::PCWSTR;

        let mut cmd = if use_executable {
            Command::new(backend_entry_path.to_str().ok_or("Invalid backend executable path")?)
        } else {
            let mut py_cmd = backend_host_command();
            py_cmd.arg(backend_entry_path.to_str().ok_or("Invalid path")?);
            py_cmd
        };
        cmd.current_dir(&backend_dir);
        cmd.env("PORT", backend_port.to_string());
        cmd.env("BIOFORGER_BACKEND_PORT", backend_port.to_string());
        if let Some(ref cfg_path) = config_path {
            cmd.env("BIOFORGER_CONFIG_PATH", cfg_path.to_string_lossy().to_string());
            if cfg_path.exists() {
                if let Ok(contents) = fs::read_to_string(cfg_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) {
                        if let Some(db) = config.get("dbPath").and_then(|v| v.as_str()) {
                            if !db.is_empty() {
                                cmd.env("BIOFORGER_DB_PATH", db);
                            }
                        }
                        if let Some(doc) = config.get("documentsDir").and_then(|v| v.as_str()) {
                            if !doc.is_empty() {
                                cmd.env("BIOFORGER_DOCUMENTS_DIR", doc);
                            }
                        }
                    }
                }
            }
        }
        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to start Python backend: {}", e))?;
        let healthy = wait_backend_healthy(&client, &health_url).await;
        if !healthy {
            let _ = child.kill();
            return Err(format!(
                "Python backend failed to become healthy. Entry: {}",
                backend_entry_path.to_string_lossy()
            ));
        }

        let job_handle = unsafe {
            CreateJobObjectW(None, PCWSTR::null())
        }.map_err(|e| format!("CreateJobObject failed: {}", e))?;

        let mut limit = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limit.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                job_handle,
                JobObjectExtendedLimitInformation,
                &limit as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        }.is_err() {
            let _ = child.kill();
            let _ = unsafe { CloseHandle(job_handle) };
            return Err("SetInformationJobObject failed".to_string());
        }

        let child_handle = child.as_raw_handle();
        if unsafe {
            AssignProcessToJobObject(job_handle, windows::Win32::Foundation::HANDLE(child_handle as _))
        }.is_err() {
            let _ = child.kill();
            let _ = unsafe { CloseHandle(job_handle) };
            return Err("AssignProcessToJobObject failed".to_string());
        }

        return Ok(Some(BackendProcess {
            child,
            _job: Some(JobHandleGuard(job_handle)),
        }));
    }

    #[cfg(not(windows))]
    {
        let mut cmd = if use_executable {
            Command::new(backend_entry_path.to_str().ok_or("Invalid backend executable path")?)
        } else {
            let mut py_cmd = backend_host_command();
            py_cmd.arg(backend_entry_path.to_str().ok_or("Invalid path")?);
            py_cmd
        };
        cmd.current_dir(&backend_dir);
        cmd.env("PORT", backend_port.to_string());
        cmd.env("BIOFORGER_BACKEND_PORT", backend_port.to_string());
        if let Some(ref cfg_path) = config_path {
            cmd.env("BIOFORGER_CONFIG_PATH", cfg_path.to_string_lossy().to_string());
            if cfg_path.exists() {
                if let Ok(contents) = fs::read_to_string(cfg_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) {
                        if let Some(db) = config.get("dbPath").and_then(|v| v.as_str()) {
                            if !db.is_empty() {
                                cmd.env("BIOFORGER_DB_PATH", db);
                            }
                        }
                        if let Some(doc) = config.get("documentsDir").and_then(|v| v.as_str()) {
                            if !doc.is_empty() {
                                cmd.env("BIOFORGER_DOCUMENTS_DIR", doc);
                            }
                        }
                    }
                }
            }
        }
        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to start Python backend: {}", e))?;
        let healthy = wait_backend_healthy(&client, &health_url).await;
        if !healthy {
            let _ = child.kill();
            return Err(format!(
                "Python backend failed to become healthy. Entry: {}",
                backend_entry_path.to_string_lossy()
            ));
        }
        Ok(Some(BackendProcess { child }))
    }
}

const OLLAMA_PORT: u16 = 11434;

#[tauri::command]
async fn start_python_backend(app: tauri::AppHandle) -> Result<String, String> {
    let config_path = get_config_path_from_app(&app);
    match ensure_python_backend_running(config_path).await {
        Ok(None) => Ok("Python backend already running".to_string()),
        Ok(Some(_)) => Ok("Python backend started".to_string()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn stop_python_backend(state: tauri::State<'_, BackendState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(get_backend_port_from_env());
    Ok("Python backend stopped".to_string())
}

fn is_ollama_running() -> bool {
    let url = format!("http://127.0.0.1:{}/api/tags", OLLAMA_PORT);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(1))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    tauri::async_runtime::block_on(async move {
        client
            .get(&url)
            .send()
            .await
            .map(|r: reqwest::Response| r.status().is_success())
            .unwrap_or(false)
    })
}

#[tauri::command]
async fn start_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
    if is_ollama_running() {
        return Ok("OLLAMA already running".to_string());
    }
    let child = Command::new("ollama")
        .arg("serve")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start OLLAMA: {}", e))?;
    if let Ok(mut guard) = state.process.lock() {
        *guard = Some(child);
    }
    Ok("OLLAMA started".to_string())
}

#[tauri::command]
async fn stop_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(OLLAMA_PORT);
    Ok("OLLAMA stopped".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let state = BackendState {
                process: Mutex::new(None),
            };
            app.manage(state);

            let ollama_state = OllamaState {
                process: Mutex::new(None),
            };
            app.manage(ollama_state);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let config_path = get_config_path_from_app(&app_handle);
                match ensure_python_backend_running(config_path).await {
                    Ok(Some(proc_)) => {
                        if let Some(backend) = app_handle.try_state::<BackendState>() {
                            if let Ok(mut guard) = backend.process.lock() {
                                *guard = Some(proc_);
                            }
                        }
                    }
                    Ok(None) => {}
                    Err(e) => {
                        eprintln!("Failed to auto-start backend: {}", e);
                    }
                }

                if let Some(splash) = app_handle.get_webview_window("splashscreen") {
                    let _ = splash.close();
                }
                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            });

            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
                let start_backend_i = MenuItem::with_id(app, "start_backend", "Start Backend", true, None::<&str>)?;
                let stop_backend_i = MenuItem::with_id(app, "stop_backend", "Stop Backend", true, None::<&str>)?;
                let start_ollama_i = MenuItem::with_id(app, "start_ollama", "Start OLLAMA", true, None::<&str>)?;
                let stop_ollama_i = MenuItem::with_id(app, "stop_ollama", "Stop OLLAMA", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[
                    &show_i,
                    &start_backend_i,
                    &stop_backend_i,
                    &start_ollama_i,
                    &stop_ollama_i,
                    &quit_i,
                ])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(move |app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.unminimize();
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "start_backend" => {
                                let app = app.clone();
                                let cfg_path = get_config_path_from_app(&app);
                                tauri::async_runtime::spawn(async move {
                                    if let Ok(Some(proc_)) = ensure_python_backend_running(cfg_path).await {
                                        if let Some(backend) = app.try_state::<BackendState>() {
                                            if let Ok(mut g) = backend.process.lock() {
                                                *g = Some(proc_);
                                            }
                                        }
                                    }
                                });
                            }
                            "stop_backend" => {
                                if let Some(backend) = app.try_state::<BackendState>() {
                                    if let Ok(mut g) = backend.process.lock() {
                                        *g = None;
                                    }
                                }
                                kill_process_on_port(get_backend_port_from_env());
                            }
                            "start_ollama" => {
                                let app = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    if is_ollama_running() {
                                        return;
                                    }
                                    if let Ok(child) = Command::new("ollama")
                                        .arg("serve")
                                        .stdout(std::process::Stdio::null())
                                        .stderr(std::process::Stdio::null())
                                        .spawn()
                                    {
                                        if let Some(ollama) = app.try_state::<OllamaState>() {
                                            if let Ok(mut g) = ollama.process.lock() {
                                                *g = Some(child);
                                            }
                                        }
                                    }
                                });
                            }
                            "stop_ollama" => {
                                if let Some(ollama) = app.try_state::<OllamaState>() {
                                    if let Ok(mut g) = ollama.process.lock() {
                                        *g = None;
                                    }
                                }
                                kill_process_on_port(OLLAMA_PORT);
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "splashscreen" {
                    return;
                }
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            upload_document,
            generate_annotations,
            estimate_finetuning_cost,
            submit_finetuning_job,
            get_documents,
            delete_document,
            get_knowledge_points,
            get_knowledge_points_for_graph,
            create_knowledge_point,
            delete_knowledge_points_batch,
            update_knowledge_point_weight,
            update_knowledge_point_excluded,
            add_knowledge_point_keyword,
            remove_knowledge_point_keyword,
            get_knowledge_point_keywords,
            get_finetuning_jobs,
            get_job_logs,
            get_job_status,
            save_api_key,
            get_api_keys,
            save_training_set,
            get_training_set,
            get_training_items,
            save_training_item,
            delete_training_item,
            get_audit_log,
            get_desensitization_log,
            get_rag_config,
            save_rag_config,
            search_fulltext,
            rebuild_fulltext_index,
            read_template_file,
            write_export_file,
            evaluation_generate,
            chat_query,
            get_local_models,
            list_system_dir,
            get_file_icon,
            get_directories,
            create_directory,
            move_document,
            move_directory,
            delete_directory,
            get_mount_points,
            get_mount_point_document_stats,
            get_recent_annotated_files,
            get_mount_point_files,
            update_mount_point_file_meta,
            get_document_summary,
            get_document_preview,
            get_document_summary_by_id,
            get_document_preview_by_id,
            create_mount_point,
            update_mount_point,
            delete_mount_point,
            delete_all_mount_points,
            get_storage_config,
            get_default_storage_paths,
            save_storage_config,
            read_chat_history,
            write_chat_history,
            start_python_backend,
            stop_python_backend,
            start_ollama,
            stop_ollama
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
