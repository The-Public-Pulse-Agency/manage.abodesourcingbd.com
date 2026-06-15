import { describe, it, expect } from "vitest";
import { addDaysUtc, startOfUtcDay, plannedDateFor, computeRag } from "./schedule";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("addDaysUtc / startOfUtcDay", () => {
  it("adds and subtracts whole days in UTC", () => {
    expect(addDaysUtc(d("2026-06-30"), -5).toISOString()).toBe("2026-06-25T00:00:00.000Z");
    expect(addDaysUtc(d("2026-06-30"), 7).toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });
  it("floors a non-midnight date to UTC day start", () => {
    expect(startOfUtcDay(new Date("2026-06-30T14:30:00.000Z")).toISOString()).toBe(
      "2026-06-30T00:00:00.000Z",
    );
  });
});

describe("plannedDateFor", () => {
  it("back-schedules from ex-factory using the negative offset", () => {
    expect(plannedDateFor(d("2026-06-30"), -45)?.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });
  it("floors a non-midnight ex-factory date first (no off-by-one)", () => {
    expect(plannedDateFor(new Date("2026-06-30T14:30:00.000Z"), -45)?.toISOString()).toBe(
      "2026-05-16T00:00:00.000Z",
    );
  });
  it("returns null when ex-factory or offset is missing", () => {
    expect(plannedDateFor(null, -45)).toBeNull();
    expect(plannedDateFor(d("2026-06-30"), null)).toBeNull();
  });
});

describe("computeRag", () => {
  const now = d("2026-06-15");
  it("DONE when an actual date is set", () => {
    expect(computeRag(d("2026-06-01"), d("2026-06-02"), now)).toBe("DONE");
  });
  it("UNSCHEDULED when no planned date", () => {
    expect(computeRag(null, null, now)).toBe("UNSCHEDULED");
  });
  it("OVERDUE when planned is before today", () => {
    expect(computeRag(d("2026-06-14"), null, now)).toBe("OVERDUE");
  });
  it("DUE_SOON at today and at the inclusive window edge", () => {
    expect(computeRag(d("2026-06-15"), null, now)).toBe("DUE_SOON");
    expect(computeRag(d("2026-06-22"), null, now)).toBe("DUE_SOON");
  });
  it("ON_TRACK just beyond the window", () => {
    expect(computeRag(d("2026-06-23"), null, now)).toBe("ON_TRACK");
  });
  it("ignores time-of-day on both planned and now", () => {
    const lateNow = new Date("2026-06-15T23:30:00.000Z");
    expect(computeRag(new Date("2026-06-15T01:00:00.000Z"), null, lateNow)).toBe("DUE_SOON");
  });
});
