export type SKU = string;

export interface Assembly {
  assembly_sku: SKU;
  name: string;
  uom: string; // "ea"
}

export interface Part {
  part_sku: SKU;
  name: string;
  uom: string; // "ea", "ft"
}

export interface BomItem {
  parent_assembly_sku: SKU; // panel type
  component_sku: SKU; // a Part SKU (or a sub-assembly in future)
  qty_per: number; // per 1 panel
  scrap_rate: number; // 0.0 to start
  yield_pct: number; // 1.0 to start
  is_phantom: boolean; // false for now
}

export interface StockRow {
  sku: SKU; // Part SKU (and/or panel SKU if ever stocked)
  on_hand_qty: number;
  reserved_qty: number;
}

// New: Build History tracking
export interface BuildHistoryRecord {
  id: string; // Auto-generated unique ID
  timestamp: string; // ISO timestamp
  work_order: string; // e.g., "WO#23898"
  sales_order: string; // e.g., "SO#23709"
  customer: string; // e.g., "TDH", "BEACON", "city of Toronto", etc.
  assembly_sku: SKU; // What panel type was built
  quantity_built: number; // How many panels
  operator?: string; // Who built them (optional)
  notes?: string; // Any additional notes
}

// New: Unified Inventory Item (combines parts and stock info)
export interface InventoryItem {
  sku: SKU;
  name: string;
  uom: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number; // Calculated: on_hand_qty - reserved_qty
  reorder_point?: number; // Optional: minimum stock level
  supplier?: string; // Optional: preferred supplier
}

export interface DataSnapshot {
  assemblies: Assembly[];
  parts: Part[];
  bom_items: BomItem[];
  stock: StockRow[];
  build_history?: BuildHistoryRecord[]; // New: optional for backward compatibility
  inventory?: InventoryItem[]; // New: unified inventory view
}

export type RequirementsPerUnit = Record<SKU, number>; // leaf part -> qty for 1 panel

export interface Buildability {
  maxBuildable: number;
  limitingComponents: Array<{
    sku: SKU;
    available: number;
    reqPerUnit: number;
    candidateBuilds: number;
  }>;
}
