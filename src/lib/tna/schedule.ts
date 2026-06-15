// Critical Path date math. Everything is computed on the UTC calendar day so a
// time-of-day on an input date can never shift a milestone by a day.
//
// Stored dates (plannedDate, exFactoryDate, issueDate) carry date-only semantics at
// UTC-midnight. To compare against "today" on the Asia/Dhaka (UTC+6, no DST) business
// calendar, callers floor `now` with `businessToday()` and pass the result wherever a
// `now` is expected — `startOfUtcDay` is idempotent on an already-floored date, so this
// composes safely with `computeRag`, `criticalPathBoard`, and `financeSummary`.

export type Rag = "DONE" | "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "UNSCHEDULED";

export const DUE_SOON_DAYS = 7;

const MS_PER_DAY = 86_400_000;

/** Asia/Dhaka is UTC+6 year-round (no DST). */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Floor a date to 00:00:00.000 UTC of its calendar day. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * UTC-midnight tagging the Asia/Dhaka calendar day that contains `now`. An evening-UTC
 * instant (e.g. 20:00 UTC = 02:00 Dhaka next day) correctly resolves to the next Dhaka
 * day. The returned Date is comparable apples-to-apples with stored UTC-midnight dates.
 */
export function businessToday(now: Date): Date {
  return startOfUtcDay(new Date(now.getTime() + DHAKA_OFFSET_MS));
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
