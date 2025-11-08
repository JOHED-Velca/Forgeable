mod data;

use std::path::PathBuf;
use data::{DataSnapshot, load_data_dir};
use tauri::Manager;

#[tauri::command]
fn load_data(data_dir: String) -> Result<DataSnapshot, String> {
    println!("🦀 load_data command called with path: {}", data_dir);
    let path = PathBuf::from(data_dir);
    
    if !path.exists() {
        let error_msg = format!("❌ Data directory does not exist: {}", path.display());
        println!("{}", error_msg);
        return Err(error_msg);
    }
    
    println!("📂 Directory exists, loading data...");
    match load_data_dir(&path) {
        Ok(data) => {
            println!("✅ Data loaded successfully: {} assemblies, {} parts, {} bom_items, {} stock",
                data.assemblies.len(), data.parts.len(), data.bom_items.len(), data.stock.len());
            Ok(data)
        },
        Err(e) => {
            let error_msg = format!("❌ Error loading data: {e:#}");
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  println!("🦀 Tauri app starting...");
  tauri::Builder::default()
    .setup(|app| {
      println!("🔧 Setting up Tauri app...");
      if cfg!(debug_assertions) {
        println!("🐛 Debug mode: enabling logging plugin");
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      println!("✅ Tauri setup complete");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![load_data])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
