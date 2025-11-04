mod data;
use std::path::PathBuf;
use tauri::Manager;
use data::{DataSnapshot, load_data_dir};
use tauri_plugin_dialog;


#[tauri::command]
fn pick_data_dir(window: tauri::Window) -> Result<String, String> {
    // Open a folder picker dialog; return the selected path as String
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    tauri::async_runtime::spawn({
        let window = window.clone();
        async move {
            let result = tauri_plugin_dialog::DialogExt::file_dialog(&window)
                .set_directory(true)
                .blocking_pick_folder();
            // result is Option<PathBuf>
            let path_str = result.map(|p| p.to_string_lossy().to_string());
            let _ = tx.send(path_str);
        }
    });
    match rx.recv() {
        Ok(Some(path)) => Ok(path),
        Ok(None) => Err("No folder selected".into()),
        Err(e) => Err(format!("Dialog error: {e}")),
    }
}

#[tauri::command]
fn load_data(data_dir: String) -> Result<DataSnapshot, String> {
    let path = PathBuf::from(data_dir);
    load_data_dir(&path).map_err(|e| format!("{e:#}"))
}


// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![pick_data_dir, load_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

