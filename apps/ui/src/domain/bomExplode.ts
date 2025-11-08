// Temporarily removing imports to test

type SKU = string;
type RequirementsPerUnit = Record<SKU, number>;
type BomItem = {
  parentAssemblySku: SKU;
  componentSku: SKU;
  qtyPer: number;
  scrapRate: number;
  yieldPct: number;
  isPhantom: boolean;
};

/**
 * Build a lookup map from parent assembly SKU to its BOM rows.
 */
export function indexBomByParent(bom: BomItem[]): Map<SKU, BomItem[]> {
  const map = new Map<SKU, BomItem[]>();
  for (const row of bom) {
    const arr = map.get(row.parentAssemblySku) ?? [];
    arr.push(row);
    map.set(row.parentAssemblySku, arr);
  }
  return map;
}

export function explodeBom(): RequirementsPerUnit {
  // Ultra-simplified version for testing
  return {};
}
