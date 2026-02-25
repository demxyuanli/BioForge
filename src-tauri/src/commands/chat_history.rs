use tauri::Manager;

const CHAT_HISTORY_FILENAME: &str = "chat-history.json";

#[tauri::command]
pub fn read_chat_history(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e: tauri::Error| e.to_string())?;
    let path = dir.join(CHAT_HISTORY_FILENAME);
    if !path.exists() {
        return Ok("[]".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_chat_history(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e: tauri::Error| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(CHAT_HISTORY_FILENAME);
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}
