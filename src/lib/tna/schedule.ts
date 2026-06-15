// Critical Path date math. Everything is computed on the UTC calendar day so a
// time-of-day on an input date can never shift a milestone by a day.
//
// NOTE (known limitation): "today" is the UTC day. The team is in Asia/Dhaka (UTC+6),
// so near UTC midnight (06:00 Dhaka) OVERDUE/DUE_SOON transitions are ~6h off. Revisit
// when the Phase 5 alert job lands (floor `now` to the Dhaka business day there).

export type Rag = "DONE" | "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "UNSCHEDULED";

export const DUE_SOON_DAYS = 7;

const MS_PER_DAY = 86_400_000;

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Floor a date to 00:00:00.000 UTC of its calendar day. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Back-schedule a milestone's planned date from the (UTC-day-floored) ex-factory date. */
export function plannedDateFor(
  exFactoryDate: Date | null | undefined,
  offsetDays: number | null | undefined,
): Date | null {
  if (!exFactoryDate || offsetDays === null || offsetDays === undefined) return null;
  return addDaysUtc(startOfUtcDay(exFactoryDate), offsetDays);
}

/** UTC day index, for date-only comparison. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function computeRag(
  plannedDate: Date | null | undefined,
  actualDate: Date | null | undefined,
  now: Date,
  dueSoonDays: number = DUE_SOON_DAYS,
): Rag {
  if (actualDate) return "DONE";
  if (!plannedDate) return "UNSCHEDULED";
  const diff = dayNumber(plannedDate) - dayNumber(now);
  if (diff < 0) return "OVERDUE";
  if (diff <= dueSoonDays) return "DUE_SOON";
  return "ON_TRACK";
}
