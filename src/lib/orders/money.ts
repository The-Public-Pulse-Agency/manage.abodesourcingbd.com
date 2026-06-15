// Money math for order totals & back-to-back margin.
//
// All arithmetic is done in integer "mills" (price x 10000, matching the
// Decimal(12,4) columns) and rounded to 2dp EXACTLY ONCE at the rollup boundary.
// Never derive margin from already-rounded value/cost — that drifts by a cent.
// NOTE: totals are currency-agnostic numbers; callers must not mix currencies in a
// single rollup (Phase 1a assumes order-line FOB is the trade currency, USD).

export type Decimalish = number | string | { toString(): string };
export type SizeRow = { qty: number; netFob: Decimalish; sellFob: Decimalish };

/** Integer-mills accumulator for one line (no rounding yet). */
export type LineMills = { qty: number; valueMills: number; costMills: number };

/** 2dp display totals. */
export type Totals = { qty: number; value: number; cost: number; margin: number };

/** Parse a decimalish money value to integer mills (4dp), float-safe via round. */
function toMills(v: Decimalish): number {
  return Math.round(Number(v.toString()) * 10000);
}

/** Convert summed mills to a 2dp number, rounding once. */
function millsTo2dp(mills: number): number {
  return Math.round(mills / 100) / 100;
}

/** Accumulate a line's sizes into integer mills (exact, unrounded). */
export function lineMills(sizes: SizeRow[]): LineMills {
  let qty = 0;
  let valueMills = 0;
  let costMills = 0;
  for (const s of sizes) {
    qty += s.qty;
    valueMills += s.qty * toMills(s.sellFob);
    costMills += s.qty * toMills(s.netFob);
  }
  return { qty, valueMills, costMills };
}

/** Sum line-level mills into 2dp totals; rounds value, cost, margin once each. */
export function rollup(parts: LineMills[]): Totals {
  let qty = 0;
  let valueMills = 0;
  let costMills = 0;
  for (const p of parts) {
    qty += p.qty;
    valueMills += p.valueMills;
    costMills += p.costMills;
  }
  return {
    qty,
    value: millsTo2dp(valueMills),
    cost: millsTo2dp(costMills),
    margin: millsTo2dp(valueMills - costMills),
  };
}

/** Totals for a single line's size rows. */
export function lineTotals(sizes: SizeRow[]): Totals {
  return rollup([lineMills(sizes)]);
}
