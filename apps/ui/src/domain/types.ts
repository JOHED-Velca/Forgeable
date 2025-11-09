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

export interface DataSnapshot {
  assemblies: Assembly[];
  parts: Part[];
  bom_items: BomItem[];
  stock: StockRow[];
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
