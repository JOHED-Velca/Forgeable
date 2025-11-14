mod data;

use std::path::PathBuf;
use data::{DataSnapshot, BuildHistoryRecord, load_data_dir, add_build_record, update_stock_after_build};
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

#[tauri::command]
fn record_build(
    data_dir: String,
    work_order: String,
    sales_order: String,
    customer: String,
    assembly_sku: String,
    quantity_built: f64,
    operator: Option<String>,
    notes: Option<String>,
) -> Result<DataSnapshot, String> {
    println!("🦀 record_build command called: {} units of {}", quantity_built, assembly_sku);
    let path = PathBuf::from(&data_dir);
    
    // Generate unique ID and timestamp
    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    
    let record = BuildHistoryRecord {
        id,
        timestamp,
        work_order,
        sales_order,
        customer,
        assembly_sku: assembly_sku.clone(),
        quantity_built,
        operator,
        notes,
    };
    
    // Add the build record
    if let Err(e) = add_build_record(&path, &record) {
        let error_msg = format!("❌ Error recording build: {e:#}");
        println!("{}", error_msg);
        return Err(error_msg);
    }
    
    // Load current data to update stock
    match load_data_dir(&path) {
        Ok(mut data) => {
            // Update stock quantities
            if let Err(e) = update_stock_after_build(
                &path,
                &assembly_sku,
                quantity_built,
                &data.bom_items,
                &mut data.stock
            ) {
                let error_msg = format!("❌ Error updating stock: {e:#}");
                println!("{}", error_msg);
                return Err(error_msg);
            }
            
            // Reload data to get updated state
            match load_data_dir(&path) {
                Ok(updated_data) => {
                    println!("✅ Build recorded and stock updated successfully");
                    Ok(updated_data)
                },
                Err(e) => {
                    let error_msg = format!("❌ Error reloading data: {e:#}");
                    println!("{}", error_msg);
                    Err(error_msg)
                }
            }
        },
        Err(e) => {
            let error_msg = format!("❌ Error loading data for stock update: {e:#}");
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
    .invoke_handler(tauri::generate_handler![load_data, record_build])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
