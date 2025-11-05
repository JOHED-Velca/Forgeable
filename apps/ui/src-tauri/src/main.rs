mod data;

use std::path::PathBuf;
use data::{DataSnapshot, load_data_dir};

#[tauri::command]
fn load_data(data_dir: String) -> Result<DataSnapshot, String> {
    let path = PathBuf::from(data_dir);
    load_data_dir(&path).map_err(|e| format!("{e:#}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
