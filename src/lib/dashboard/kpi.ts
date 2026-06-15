// Pure dashboard KPI helpers — no DB, fully unit-testable.

export type OtdResult = { completed: number; onTime: number; pct: number | null };

/**
 * On-Time-Delivery over completed milestones. A milestone counts only when it has BOTH
 * a planned and an actual date; on-time means actual <= planned (date-only). `pct` is
 * null when nothing is completed yet (avoids NaN / a misleading 0%).
 */
export function otdPercent(
  milestones: { plannedDate: Date | null; actualDate: Date | null }[],
): OtdResult {
  let completed = 0;
  let onTime = 0;
  for (const m of milestones) {
    if (!m.plannedDate || !m.actualDate) continue;
    completed += 1;
    if (m.actualDate.getTime() <= m.plannedDate.getTime()) onTime += 1;
  }
  if (completed === 0) return { completed: 0, onTime: 0, pct: null };
  return { completed, onTime, pct: Math.round((onTime / completed) * 10000) / 100 };
}
