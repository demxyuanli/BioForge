use std::process::Command;
use std::time::Duration;

use crate::commands::backend_lifecycle::kill_process_on_port;
use crate::state::OllamaState;

pub const OLLAMA_PORT: u16 = 11434;

pub fn is_ollama_running() -> bool {
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
pub async fn start_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
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
pub async fn stop_ollama(state: tauri::State<'_, OllamaState>) -> Result<String, String> {
    if let Ok(mut guard) = state.process.lock() {
        *guard = None;
    }
    kill_process_on_port(OLLAMA_PORT);
    Ok("OLLAMA stopped".to_string())
}
