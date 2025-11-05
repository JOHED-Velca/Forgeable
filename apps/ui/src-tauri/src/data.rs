use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs::File;
use std::path::Path;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Assembly {
    #[serde(rename = "assembly_sku")]
    pub assembly_sku: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "uom")]
    pub uom: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Part {
    #[serde(rename = "part_sku")]
    pub part_sku: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "uom")]
    pub uom: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BomItem {
    #[serde(rename = "parent_assembly_sku")]
    pub parent_assembly_sku: String,
    #[serde(rename = "component_sku")]
    pub component_sku: String,
    #[serde(rename = "qty_per")]
    pub qty_per: f64,
    #[serde(rename = "scrap_rate")]
    pub scrap_rate: f64,
    #[serde(rename = "yield_pct")]
    pub yield_pct: f64,
    #[serde(rename = "is_phantom")]
    pub is_phantom: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct StockRow {
    #[serde(rename = "sku")]
    pub sku: String,
    #[serde(rename = "on_hand_qty")]
    pub on_hand_qty: f64,
    #[serde(rename = "reserved_qty")]
    pub reserved_qty: f64,
}

#[derive(Debug, serde::Serialize)]
pub struct DataSnapshot {
    pub assemblies: Vec<Assembly>,
    pub parts: Vec<Part>,
    pub bom_items: Vec<BomItem>,
    pub stock: Vec<StockRow>,
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

pub fn load_data_dir(data_dir: &Path) -> Result<DataSnapshot> {
    let assemblies = read_csv::<Assembly>(&data_dir.join("assemblies.csv"))
        .context("Reading assemblies.csv")?;
    let parts = read_csv::<Part>(&data_dir.join("parts.csv"))
        .context("Reading parts.csv")?;
    let bom_items = read_csv::<BomItem>(&data_dir.join("bom_items.csv"))
        .context("Reading bom_items.csv")?;
    let stock = read_csv::<StockRow>(&data_dir.join("stock.csv"))
        .context("Reading stock.csv")?;

    Ok(DataSnapshot {
        assemblies,
        parts,
        bom_items,
        stock,
    })
}
