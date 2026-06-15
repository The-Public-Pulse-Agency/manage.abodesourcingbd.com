export type ProductionQty = { cutQty: number; sewQty: number; finishQty: number };
export type ProductionPct = { cutPct: number; sewPct: number; finishPct: number };

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function productionProgress(orderedQty: number, q: ProductionQty): ProductionPct {
  return {
    cutPct: pct(q.cutQty, orderedQty),
    sewPct: pct(q.sewQty, orderedQty),
    finishPct: pct(q.finishQty, orderedQty),
  };
}
