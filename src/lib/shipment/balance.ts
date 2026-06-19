export type SizeQty = { label: string; qty: number };
export type SizeBalance = { label: string; ordered: number; shipped: number; balance: number };

export function remainingBySize(ordered: SizeQty[], shipped: SizeQty[]): SizeBalance[] {
  const shippedByLabel = new Map<string, number>();
  for (const s of shipped) shippedByLabel.set(s.label, (shippedByLabel.get(s.label) ?? 0) + s.qty);
  return ordered.map((o) => {
    const ship = shippedByLabel.get(o.label) ?? 0;
    return { label: o.label, ordered: o.qty, shipped: ship, balance: o.qty - ship };
  });
}

/**
 * Validates that every requested size exists on the order line. Over-shipment (qty above the
 * remaining balance) is ALLOWED — factories over-produce and the extra still ships; the excess
 * is recorded as a note on the shipment line (see excessBySize) rather than blocked.
 */
export function assertWithinBalance(balances: SizeBalance[], requested: SizeQty[]): void {
  const byLabel = new Map(balances.map((b) => [b.label, b]));
  for (const r of requested) {
    if (r.qty <= 0) continue;
    if (!byLabel.has(r.label)) throw new Error(`Size ${r.label} is not in the order line`);
  }
}

/** Per-size amounts shipped beyond the remaining balance (over-shipment), if any. */
export function excessBySize(balances: SizeBalance[], requested: SizeQty[]): { label: string; excess: number }[] {
  const byLabel = new Map(balances.map((b) => [b.label, b]));
  const out: { label: string; excess: number }[] = [];
  for (const r of requested) {
    const b = byLabel.get(r.label);
    if (b && r.qty > b.balance) out.push({ label: r.label, excess: r.qty - b.balance });
  }
  return out;
}

/** A human note summarising over-shipment for a line, or null if within balance. */
export function overShipNote(excess: { label: string; excess: number }[]): string | null {
  if (excess.length === 0) return null;
  return `Over-ship: ${excess.map((e) => `${e.label} +${e.excess}`).join(", ")} pcs`;
}
