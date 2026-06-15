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

export function assertWithinBalance(balances: SizeBalance[], requested: SizeQty[]): void {
  const byLabel = new Map(balances.map((b) => [b.label, b]));
  for (const r of requested) {
    if (r.qty <= 0) continue;
    const b = byLabel.get(r.label);
    if (!b) throw new Error(`Size ${r.label} is not in the order line`);
    if (r.qty > b.balance) {
      throw new Error(`Size ${r.label}: shipping ${r.qty} exceeds balance ${b.balance}`);
    }
  }
}
