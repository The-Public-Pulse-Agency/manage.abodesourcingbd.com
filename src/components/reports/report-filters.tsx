"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type FilterSelect = { param: string; allLabel: string; options: { value: string; label: string }[] };

export function ReportFilters({ selects, searchPlaceholder, resultLabel }: { selects: FilterSelect[]; searchPlaceholder: string; resultLabel: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  function set(param: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(param, value);
    else p.delete(param);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  const active = selects.some((s) => sp.get(s.param)) || sp.get("q");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        defaultValue={sp.get("q") ?? ""}
        onKeyDown={(e) => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value.trim()); }}
        onBlur={(e) => { if (e.target.value.trim() !== (sp.get("q") ?? "")) set("q", e.target.value.trim()); }}
        placeholder={searchPlaceholder}
        className="input min-w-[15rem] flex-1"
        aria-label="Search"
      />
      {selects.map((s) => (
        <select key={s.param} value={sp.get(s.param) ?? ""} onChange={(e) => set(s.param, e.target.value)} className="select" aria-label={s.allLabel}>
          <option value="">{s.allLabel}</option>
          {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {active && (
        <button type="button" onClick={() => router.push(pathname)} className="rounded-sm border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent">Clear</button>
      )}
      <span className="ml-auto text-xs text-ink-soft">{resultLabel}</span>
    </div>
  );
}
