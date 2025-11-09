import type { Buildability, RequirementsPerUnit, SKU, StockRow } from "./types";

export function computeMaxBuildable(
  reqPerUnit: RequirementsPerUnit,
  stock: StockRow[],
  respectReservations = true
): Buildability {
  const avail = new Map<SKU, number>();
  for (const s of stock) {
    const a = s.on_hand_qty - (respectReservations ? s.reserved_qty : 0);
    avail.set(s.sku, Math.max(0, a));
  }

  let maxBuildable = Number.POSITIVE_INFINITY;
  const allCandidates: Buildability["limitingComponents"] = [];

  for (const [sku, req] of Object.entries(reqPerUnit)) {
    if (req <= 0) continue;
    const a = avail.get(sku) ?? 0;
    const candidate = Math.floor(a / req); // whole panels only
    allCandidates.push({
      sku,
      available: a,
      reqPerUnit: req,
      candidateBuilds: candidate,
    });
    if (candidate < maxBuildable) maxBuildable = candidate;
  }

  if (!isFinite(maxBuildable)) maxBuildable = 0;
  const limiting = allCandidates.filter(
    (c) => c.candidateBuilds === maxBuildable
  );
  return { maxBuildable, limitingComponents: limiting };
}
