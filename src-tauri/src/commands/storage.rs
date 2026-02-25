use std::fs;

use crate::backend_url::{
    find_main_py_path, get_backend_port_from_env, get_config_path_from_app, migrate_config_from_legacy,
    BACKEND_PORT_CONFIG_KEY,
};

#[tauri::command]
pub fn get_storage_config(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let config_path = get_config_path_from_app(&app).ok_or("Config path not found")?;
    migrate_config_from_legacy(&config_path);
    if !config_path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    Ok(Some(v))
}

#[tauri::command]
pub fn get_default_storage_paths() -> Result<serde_json::Value, String> {
    let backend_dir = find_main_py_path()
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
pub fn save_storage_config(
    app: tauri::AppHandle,
    documents_dir: String,
    db_path: String,
) -> Result<(), String> {
    let config_path = get_config_path_from_app(&app).ok_or("Config path not found")?;
    let parent = config_path.parent().ok_or("Invalid config path")?;
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
                serde_json::json!(get_backend_port_from_env()),
            );
        }
    }
    fs::write(config_path, config.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}
