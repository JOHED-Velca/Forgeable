use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs::{File, OpenOptions};
use std::path::Path;
use std::io::Write;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Assembly {
    pub assembly_sku: String,
    pub name: String,
    pub uom: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Part {
    pub part_sku: String,
    pub name: String,
    pub uom: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BomItem {
    pub parent_assembly_sku: String,
    pub component_sku: String,
    pub qty_per: f64,
    pub scrap_rate: f64,
    pub yield_pct: f64,
    pub is_phantom: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct StockRow {
    pub sku: String,
    pub on_hand_qty: f64,
    pub reserved_qty: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BuildHistoryRecord {
    pub id: String,
    pub timestamp: String,
    pub work_order: String,
    pub sales_order: String,
    pub customer: String,
    pub assembly_sku: String,
    pub quantity_built: f64,
    #[serde(default)]
    pub operator: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct InventoryItem {
    pub sku: String,
    pub name: String,
    pub uom: String,
    pub on_hand_qty: f64,
    pub reserved_qty: f64,
    pub available_qty: f64,
    #[serde(default)]
    pub reorder_point: Option<f64>,
    #[serde(default)]
    pub supplier: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct DataSnapshot {
    pub assemblies: Vec<Assembly>,
    pub parts: Vec<Part>,
    pub bom_items: Vec<BomItem>,
    pub stock: Vec<StockRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub build_history: Option<Vec<BuildHistoryRecord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inventory: Option<Vec<InventoryItem>>,
}

fn read_csv<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Vec<T>> {
    let file = File::open(path)
        .with_context(|| format!("Failed to open CSV: {}", path.display()))?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(false)
        .trim(csv::Trim::All)
        .from_reader(file);
    let mut out = Vec::new();
    for rec in rdr.deserialize() {
        let row: T = rec.with_context(|| format!("Failed to parse row in {}", path.display()))?;
        out.push(row);
    }
    Ok(out)
}

pub fn read_csv_optional<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<Vec<T>> {
    match read_csv::<T>(path) {
        Ok(data) => Some(data),
        Err(_) => None, // File doesn't exist or can't be read
    }
}

fn create_unified_inventory(parts: &[Part], stock: &[StockRow]) -> Vec<InventoryItem> {
    let mut inventory = Vec::new();
    
    // Create a map of stock data for quick lookup
    let stock_map: std::collections::HashMap<String, &StockRow> = 
        stock.iter().map(|s| (s.sku.clone(), s)).collect();
    
    for part in parts {
        let stock_info = stock_map.get(&part.part_sku);
        let (on_hand, reserved) = match stock_info {
            Some(stock) => (stock.on_hand_qty, stock.reserved_qty),
            None => (0.0, 0.0), // Part exists but no stock record
        };
        
        inventory.push(InventoryItem {
            sku: part.part_sku.clone(),
            name: part.name.clone(),
            uom: part.uom.clone(),
            on_hand_qty: on_hand,
            reserved_qty: reserved,
            available_qty: on_hand - reserved,
            reorder_point: None, // Could be loaded from separate CSV in future
            supplier: None, // Could be loaded from separate CSV in future
        });
    }
    
    inventory
}

pub fn load_data_dir(data_dir: &Path) -> Result<DataSnapshot> {
    let assemblies = read_csv::<Assembly>(&data_dir.join("assemblies.csv"))
        .context("Reading assemblies.csv")?;
    let parts = read_csv::<Part>(&data_dir.join("parts.csv"))
        .context("Reading parts.csv")?;
    let bom_items = read_csv::<BomItem>(&data_dir.join("bom_items.csv"))
        .context("Reading bom_items.csv")?;
    let stock = read_csv::<StockRow>(&data_dir.join("stock.csv"))
        .context("Reading stock.csv")?;
    
    // Optional files - don't fail if they don't exist yet
    let build_history = read_csv_optional::<BuildHistoryRecord>(&data_dir.join("build_history.csv"));
    
    // Create unified inventory from parts and stock
    let inventory = create_unified_inventory(&parts, &stock);

    Ok(DataSnapshot {
        assemblies,
        parts,
        bom_items,
        stock,
        build_history,
        inventory: Some(inventory),
    })
}

/// Add a build record to the build_history.csv file
pub fn add_build_record(data_dir: &Path, record: &BuildHistoryRecord) -> Result<()> {
    let file_path = data_dir.join("build_history.csv");
    
    // Check if file exists, if not create with headers
    let file_exists = file_path.exists();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .with_context(|| format!("Failed to open build_history.csv for writing"))?;
    
    // Write headers if file is new
    if !file_exists {
        writeln!(file, "id,timestamp,work_order,sales_order,customer,assembly_sku,quantity_built,operator,notes")
            .context("Failed to write headers to build_history.csv")?;
    }
    
    // Write the record
    writeln!(file, "{},{},{},{},{},{},{},{},{}",
        record.id,
        record.timestamp,
        record.work_order,
        record.sales_order,
        record.customer,
        record.assembly_sku,
        record.quantity_built,
        record.operator.as_deref().unwrap_or(""),
        record.notes.as_deref().unwrap_or("")
    ).context("Failed to write build record")?;
    
    Ok(())
}

/// Update stock quantities by deducting parts consumed in a build
pub fn update_stock_after_build(
    data_dir: &Path,
    assembly_sku: &str,
    quantity_built: f64,
    bom_items: &[BomItem],
    current_stock: &mut Vec<StockRow>
) -> Result<()> {
    // Find all parts needed for this assembly
    let mut parts_consumed = std::collections::HashMap::new();
    
    for bom_item in bom_items {
        if bom_item.parent_assembly_sku == assembly_sku {
            let total_needed = bom_item.qty_per * quantity_built;
            *parts_consumed.entry(bom_item.component_sku.clone()).or_insert(0.0) += total_needed;
        }
    }
    
    // Update stock quantities
    for stock_item in current_stock.iter_mut() {
        if let Some(consumed) = parts_consumed.get(&stock_item.sku) {
            stock_item.on_hand_qty = (stock_item.on_hand_qty - consumed).max(0.0);
        }
    }
    
    // Write updated stock back to CSV
    write_stock_csv(data_dir, current_stock)?;
    
    Ok(())
}

/// Write stock data back to stock.csv
fn write_stock_csv(data_dir: &Path, stock: &[StockRow]) -> Result<()> {
    let file_path = data_dir.join("stock.csv");
    let mut file = File::create(&file_path)
        .with_context(|| format!("Failed to create stock.csv for writing"))?;
    
    // Write headers
    writeln!(file, "sku,on_hand_qty,reserved_qty")
        .context("Failed to write headers to stock.csv")?;
    
    // Write stock data
    for stock_item in stock {
        writeln!(file, "{},{},{}",
            stock_item.sku,
            stock_item.on_hand_qty,
            stock_item.reserved_qty
        ).context("Failed to write stock record")?;
    }
    
    Ok(())
}

/// Add a build record to the panel_history.csv file
pub fn add_panel_history_record(data_dir: &Path, record: &BuildHistoryRecord) -> Result<()> {
    let file_path = data_dir.join("panel_history.csv");
    
    // Check if file exists, if not create with headers
    let file_exists = file_path.exists();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .with_context(|| format!("Failed to open panel_history.csv for writing"))?;
    
    // Write headers if file is new
    if !file_exists {
        writeln!(file, "id,timestamp,work_order,sales_order,customer,assembly_sku,quantity_built,operator,notes")
            .context("Failed to write headers to panel_history.csv")?;
    }
    
    // Write the record
    writeln!(file, "{},{},{},{},{},{},{},{},{}",
        record.id,
        record.timestamp,
        record.work_order,
        record.sales_order,
        record.customer,
        record.assembly_sku,
        record.quantity_built,
        record.operator.as_deref().unwrap_or(""),
        record.notes.as_deref().unwrap_or("")
    ).context("Failed to write panel history record")?;
    
    Ok(())
}

pub fn load_main_inventory(data_dir: &Path) -> Result<Vec<InventoryItem>> {
    let main_inventory_path = data_dir.join("main_inventory.csv");
    
    if !main_inventory_path.exists() {
        return Err(anyhow::anyhow!("main_inventory.csv not found in {}", data_dir.display()));
    }
    
    let mut inventory_items = read_csv::<InventoryItem>(&main_inventory_path)
        .context("Failed to read main_inventory.csv")?;
    
    // Calculate available_qty for each item (on_hand_qty - reserved_qty)
    for item in &mut inventory_items {
        item.available_qty = item.on_hand_qty - item.reserved_qty;
    }
    
    Ok(inventory_items)
}
