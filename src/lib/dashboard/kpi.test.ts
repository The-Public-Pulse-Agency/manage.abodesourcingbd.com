import { describe, it, expect } from "vitest";
import { otdPercent } from "./kpi";
import { businessToday } from "@/lib/tna/schedule";

const d = (s: string) => new Date(s);

describe("otdPercent", () => {
  it("computes percentage over completed milestones (2dp)", () => {
    const r = otdPercent([
      { plannedDate: d("2026-06-10T00:00:00Z"), actualDate: d("2026-06-09T00:00:00Z") }, // on time
      { plannedDate: d("2026-06-10T00:00:00Z"), actualDate: d("2026-06-10T00:00:00Z") }, // on time (==)
      { plannedDate: d("2026-06-10T00:00:00Z"), actualDate: d("2026-06-12T00:00:00Z") }, // late
    ]);
    expect(r).toEqual({ completed: 3, onTime: 2, pct: 66.67 });
  });

  it("ignores milestones missing planned or actual", () => {
    const r = otdPercent([
      { plannedDate: d("2026-06-10T00:00:00Z"), actualDate: null },
      { plannedDate: null, actualDate: d("2026-06-10T00:00:00Z") },
      { plannedDate: d("2026-06-10T00:00:00Z"), actualDate: d("2026-06-09T00:00:00Z") },
    ]);
    expect(r).toEqual({ completed: 1, onTime: 1, pct: 100 });
  });

  it("returns pct null when nothing completed (no NaN)", () => {
    expect(otdPercent([])).toEqual({ completed: 0, onTime: 0, pct: null });
    expect(otdPercent([{ plannedDate: d("2026-06-10T00:00:00Z"), actualDate: null }])).toEqual({
      completed: 0,
      onTime: 0,
      pct: null,
    });
  });
});

describe("businessToday (Asia/Dhaka UTC+6)", () => {
  it("rolls an evening-UTC instant into the next Dhaka day", () => {
    // 20:00 UTC = 02:00 Dhaka on the 16th
    expect(businessToday(d("2026-06-15T20:00:00Z")).toISOString()).toBe("2026-06-16T00:00:00.000Z");
  });

  it("keeps a morning-UTC instant on the same Dhaka day", () => {
    // 03:00 UTC = 09:00 Dhaka on the 15th
    expect(businessToday(d("2026-06-15T03:00:00Z")).toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("is idempotent when re-floored", () => {
    const once = businessToday(d("2026-06-15T20:00:00Z"));
    expect(businessToday(once).toISOString()).toBe(once.toISOString());
  });
});
