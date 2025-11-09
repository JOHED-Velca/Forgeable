import type { BomItem, RequirementsPerUnit, SKU } from "./types";

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

/**
 * Explode a panel BOM into leaf part requirements per 1 panel.
 */
export function explodeBom(
  assemblySku: SKU,
  bomByParent: Map<SKU, BomItem[]>,
  isAssembly: (sku: SKU) => boolean,
  options = { includeScrap: true, minYield: 0.01 }
): RequirementsPerUnit {
  const visited = new Set<SKU>();
  const req = new Map<SKU, number>();

  function addReq(sku: SKU, qty: number) {
    req.set(sku, (req.get(sku) ?? 0) + qty);
  }

  function dfs(currentSku: SKU, multiplier: number) {
    if (!currentSku) {
      throw new Error(`DFS called with undefined/null SKU`);
    }

    const children = bomByParent.get(currentSku) ?? [];

    if (children.length === 0) {
      addReq(currentSku, multiplier);
      return;
    }

    if (visited.has(currentSku)) {
      throw new Error(`Circular BOM detected at ${currentSku}`);
    }
    visited.add(currentSku);

    for (const item of children) {
      let effective = item.qtyPer;
      if (options.includeScrap) {
        effective = effective * (1 + item.scrapRate);
      }
      const yieldEff = Math.max(item.yieldPct, options.minYield);
      effective = effective / yieldEff;

      const hasChildren = (bomByParent.get(item.componentSku) ?? []).length > 0;

      if (item.isPhantom || hasChildren) {
        dfs(item.componentSku, multiplier * effective);
      } else {
        addReq(item.componentSku, multiplier * effective);
      }
    }

    visited.delete(currentSku);
  }

  dfs(assemblySku, 1);
  const out: RequirementsPerUnit = {};
  for (const [sku, qty] of req.entries()) out[sku] = qty;
  return out;
}
