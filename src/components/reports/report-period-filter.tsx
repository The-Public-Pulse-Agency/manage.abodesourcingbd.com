"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Year + month period filter driven by URL params `shipYear` (YYYY) and `shipMonth` (01-12).
 * Pick a year for the whole year, add a month to narrow to that month. Month is disabled until
 * a year is chosen. Used to scope a report's qty/value to a ship period.
 */
export function ReportPeriodFilter({ years }: { years: number[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  function set(updates: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  const year = sp.get("shipYear") ?? "";
  const month = sp.get("shipMonth") ?? "";

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={year}
        onChange={(e) => set({ shipYear: e.target.value, ...(e.target.value ? {} : { shipMonth: "" }) })}
        className="select"
        aria-label="Ship year"
        title="Filter by ship year"
      >
        <option value="">All years</option>
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      <select
        value={month}
        onChange={(e) => set({ shipMonth: e.target.value })}
        disabled={!year}
        className="select disabled:opacity-50"
        aria-label="Ship month"
        title={year ? "Filter by ship month" : "Pick a year first"}
      >
        <option value="">All months</option>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>
    </span>
  );
}
