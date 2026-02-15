// Backend port and base URL resolution from config/env.
use std::fs;
use std::net::TcpListener;
use std::path::Path;
use std::path::PathBuf;
use tauri::Manager;

pub const DEFAULT_BACKEND_PORT: u16 = 8778;
const CONFIG_FILENAME: &str = "bioforger-config.json";
pub const BACKEND_PORT_CONFIG_KEY: &str = "backendPort";

pub fn get_config_path_from_app(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join(CONFIG_FILENAME))
}

pub fn get_backend_port_from_env() -> u16 {
    std::env::var("BIOFORGER_BACKEND_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .filter(|p| *p > 0)
        .unwrap_or(DEFAULT_BACKEND_PORT)
}

pub fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

pub fn pick_available_backend_port(preferred: u16) -> u16 {
    if is_port_available(preferred) {
        return preferred;
    }
    let end = preferred.saturating_add(200);
    let mut p = preferred.saturating_add(1);
    while p <= end {
        if is_port_available(p) {
            return p;
        }
        p = p.saturating_add(1);
    }
    preferred
}

pub fn read_backend_port_from_config(config_path: &PathBuf) -> Option<u16> {
    let contents = fs::read_to_string(config_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&contents).ok()?;
    json.get(BACKEND_PORT_CONFIG_KEY)
        .and_then(|v| v.as_u64())
        .and_then(|v| u16::try_from(v).ok())
        .filter(|p| *p > 0)
}

pub fn write_backend_port_to_config(config_path: &PathBuf, backend_port: u16) -> Result<(), String> {
    let mut config = if config_path.exists() {
        let raw = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !config.is_object() {
        config = serde_json::json!({});
    }
    if let Some(obj) = config.as_object_mut() {
        obj.insert(BACKEND_PORT_CONFIG_KEY.to_string(), serde_json::json!(backend_port));
    }
    let parent = config_path.parent().ok_or("Invalid config path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    fs::write(config_path, config.to_string()).map_err(|e| e.to_string())
}

pub fn resolve_backend_port(config_path: Option<&PathBuf>) -> u16 {
    if let Some(cfg) = config_path {
        if let Some(p) = read_backend_port_from_config(cfg) {
            return p;
        }
        let chosen = pick_available_backend_port(DEFAULT_BACKEND_PORT);
        let _ = write_backend_port_to_config(cfg, chosen);
        return chosen;
    }
    DEFAULT_BACKEND_PORT
}

/// Returns backend base URL for use in commands (config port, then env, then default).
pub fn get_backend_base_url(app: &tauri::AppHandle) -> String {
    let port = if let Some(cfg) = get_config_path_from_app(app) {
        read_backend_port_from_config(&cfg).unwrap_or_else(get_backend_port_from_env)
    } else {
        get_backend_port_from_env()
    };
    format!("http://127.0.0.1:{}", port)
}

pub fn configure_python_env(backend_dir: &Path, backend_port: u16) {
    std::env::set_var("BIOFORGER_BACKEND_PORT", backend_port.to_string());
    let backend_dir_str = backend_dir.to_string_lossy().to_string();
    let sep = if cfg!(windows) { ';' } else { ':' };
    let existing = std::env::var("PYTHONPATH").unwrap_or_default();
    let exists = existing
        .split(sep)
        .any(|item| !item.trim().is_empty() && item == backend_dir_str);
    if !exists {
        let merged = if existing.trim().is_empty() {
            backend_dir_str
        } else {
            format!("{}{}{}", backend_dir_str, sep, existing)
        };
        std::env::set_var("PYTHONPATH", merged);
    }
}

pub fn find_backend_executable_path() -> Option<PathBuf> {
    let exe_name = if cfg!(windows) {
        "bioforger-backend.exe"
    } else {
        "bioforger-backend"
    };
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("python-backend").join("dist").join(exe_name));
        if let Some(parent_dir) = current_dir.parent() {
            candidates.push(parent_dir.join("python-backend").join("dist").join(exe_name));
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(exe_name));
            candidates.push(exe_dir.join("_up_").join(exe_name));
            candidates.push(exe_dir.join("resources").join(exe_name));
            candidates.push(exe_dir.join("resources").join("_up_").join(exe_name));
            candidates.push(exe_dir.join("..").join("Resources").join(exe_name));
            candidates.push(exe_dir.join("..").join("Resources").join("_up_").join(exe_name));
        }
    }

    candidates.into_iter().find(|p| p.exists())
}

pub fn find_main_py_path() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("python-backend").join("main.py"));
        if let Some(parent_dir) = current_dir.parent() {
            candidates.push(parent_dir.join("python-backend").join("main.py"));
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Common runtime layouts.
            candidates.push(exe_dir.join("python-backend").join("main.py"));
            candidates.push(exe_dir.join("_up_").join("python-backend").join("main.py"));
            candidates.push(exe_dir.join("resources").join("python-backend").join("main.py"));
            candidates.push(exe_dir.join("resources").join("_up_").join("python-backend").join("main.py"));
            // macOS app bundle resources path.
            candidates.push(
                exe_dir
                    .join("..")
                    .join("Resources")
                    .join("python-backend")
                    .join("main.py"),
            );
            candidates.push(
                exe_dir
                    .join("..")
                    .join("Resources")
                    .join("_up_")
                    .join("python-backend")
                    .join("main.py"),
            );
        }
    }

    candidates.into_iter().find(|p| p.exists())
}

pub fn migrate_config_from_legacy(app_config_path: &PathBuf) {
    let legacy = find_main_py_path().and_then(|p| p.parent().map(|d| d.join(CONFIG_FILENAME)));
    if let Some(ref old) = legacy {
        if old.exists() && !app_config_path.exists() {
            if let Some(parent) = app_config_path.parent() {
                let _ = fs::create_dir_all(parent);
                let _ = fs::copy(old, app_config_path);
            }
        }
    }
}
