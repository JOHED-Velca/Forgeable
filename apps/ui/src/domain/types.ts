export type SKU = string;

export interface Assembly {
  assemblySku: SKU;
  name: string;
  uom: string; // "ea"
}

export interface Part {
  partSku: SKU;
  name: string;
  uom: string; // "ea", "ft"
}

export interface BomItem {
  parentAssemblySku: SKU; // panel type
  componentSku: SKU; // a Part SKU (or a sub-assembly in future)
  qtyPer: number; // per 1 panel
  scrapRate: number; // 0.0 to start
  yieldPct: number; // 1.0 to start
  isPhantom: boolean; // false for now
}

export interface StockRow {
  sku: SKU; // Part SKU (and/or panel SKU if ever stocked)
  onHandQty: number;
  reservedQty: number;
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
