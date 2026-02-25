use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::backend_url::{
    configure_python_env, find_backend_executable_path, find_main_py_path, get_config_path_from_app,
    get_backend_port_from_env, resolve_backend_port,
};
use crate::state::{BackendProcess, BackendState};
#[cfg(windows)]
use crate::state::JobHandleGuard;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn backend_host_command() -> Command {
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

pub fn kill_process_on_port(port: u16) {
    #[cfg(windows)]
    {
        let port_str = format!(":{}", port);
        let output = match Command::new("netstat").args(["-ano"]).output() {
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

pub async fn ensure_python_backend_running(
    config_path: Option<PathBuf>,
) -> Result<Option<BackendProcess>, String> {
    let main_py_path = find_main_py_path();
    let backend_exe_path = find_backend_executable_path();
    let (backend_dir, backend_entry_path, use_executable) = if let Some(main_py) = main_py_path {
        let backend_dir = main_py
            .parent()
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
    let backend_port = resolve_backend_port(config_path.as_ref());
    configure_python_env(&backend_dir, backend_port);
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
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start Python backend: {}", e))?;
        let healthy = wait_backend_healthy(&client, &health_url).await;
        if !healthy {
            let _ = child.kill();
            return Err(format!(
                "Python backend failed to become healthy. Entry: {}",
                backend_entry_path.to_string_lossy()
            ));
        }

        let job_handle = unsafe { CreateJobObjectW(None, PCWSTR::null()) }
            .map_err(|e| format!("CreateJobObject failed: {}", e))?;

        let mut limit = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limit.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                job_handle,
                JobObjectExtendedLimitInformation,
                &limit as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        }.is_err()
        {
            let _ = child.kill();
            let _ = unsafe { CloseHandle(job_handle) };
            return Err("SetInformationJobObject failed".to_string());
        }

        let child_handle = child.as_raw_handle();
        if unsafe {
            AssignProcessToJobObject(
                job_handle,
                windows::Win32::Foundation::HANDLE(child_handle as _),
            )
        }.is_err()
        {
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
        let mut child = cmd
            .spawn()
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

#[tauri::command]
pub async fn start_python_backend(app: tauri::AppHandle) -> Result<String, String> {
    let config_path = get_config_path_from_app(&app);
    match ensure_python_backend_running(config_path).await {
        Ok(None) => Ok("Python backend already running".to_string()),
        Ok(Some(_)) => Ok("Python backend started".to_string()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn stop_python_backend(state: tauri::State<'_, BackendState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(get_backend_port_from_env());
    Ok("Python backend stopped".to_string())
}
