// Learn more at https://tauri.app/develop/calling-rust/
mod backend_url;
mod state;
mod commands;

use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

use backend_url::{get_config_path_from_app, get_backend_port_from_env};
use state::{BackendState, OllamaState};
use commands::backend_lifecycle::{
    ensure_python_backend_running, kill_process_on_port, start_python_backend, stop_python_backend,
};
use commands::ollama::{is_ollama_running, start_ollama, stop_ollama, OLLAMA_PORT};
use commands::documents::{
    delete_document, get_document_preview_by_id, get_document_summary_by_id, get_documents,
    upload_document,
};
use commands::annotations::generate_annotations;
use commands::knowledge_points::{
    add_knowledge_point_keyword, create_knowledge_point, delete_knowledge_points_batch,
    get_knowledge_point_keywords, get_knowledge_points, get_knowledge_points_for_graph,
    remove_knowledge_point_keyword, update_knowledge_point_excluded, update_knowledge_point_weight,
};
use commands::finetuning::{
    estimate_finetuning_cost, get_finetuning_jobs, get_job_logs, get_job_status,
    submit_finetuning_job,
};
use commands::training::{
    delete_training_item, get_training_items, get_training_set, save_training_item,
    save_training_set,
};
use commands::api_keys::{get_api_keys, save_api_key};
use commands::logs::{get_audit_log, get_desensitization_log};
use commands::config::{get_rag_config, save_rag_config};
use commands::search::{rebuild_fulltext_index, search_fulltext};
use commands::misc::{get_file_icon, get_local_models, list_system_dir, read_template_file, write_export_file};
use commands::directories::{
    create_directory, delete_directory, get_directories, move_document, move_directory,
};
use commands::mount_points::{
    create_mount_point, delete_all_mount_points, delete_mount_point, get_document_preview,
    get_document_summary, get_mount_point_document_stats, get_mount_point_files,
    get_mount_points, get_recent_annotated_files, update_mount_point,
    update_mount_point_file_meta,
};
use commands::skills::{create_skill, delete_skill, get_skills, update_skill};
use commands::rules::{create_rule, delete_rule, get_rules, update_rule};
use commands::storage::{get_default_storage_paths, get_storage_config, save_storage_config};
use commands::chat_history::{read_chat_history, write_chat_history};
use commands::evaluation::evaluation_generate;
use commands::chat::chat_query;

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
            get_skills,
            create_skill,
            update_skill,
            delete_skill,
            get_rules,
            create_rule,
            update_rule,
            delete_rule,
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
