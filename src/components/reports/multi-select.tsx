"use client";
import { useState, useRef, useEffect } from "react";
export type Opt = { value: string; label: string };
export function MultiSelect({ allLabel, options, selected, onChange }: { allLabel: string; options: Opt[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const sel = new Set(selected);
  const toggle = (v: string) => { const n = new Set(sel); if (n.has(v)) n.delete(v); else n.add(v); onChange([...n]); };
  const label = selected.length === 0 ? allLabel : `${allLabel.replace(/^All /, "")} · ${selected.length}`;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="select flex items-center gap-2 whitespace-nowrap text-left">
        <span className={selected.length ? "font-medium" : "text-ink-soft"}>{label}</span>
        <span aria-hidden className="ml-auto text-[0.6rem] opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-sm border border-line bg-surface p-1 shadow-lg">
          {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="block w-full rounded-sm px-2 py-1 text-left text-xs text-accent hover:bg-paper">Clear selection</button>}
          {options.length === 0 && <p className="px-2 py-1 text-xs text-ink-soft">No options</p>}
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-paper">
              <input type="checkbox" checked={sel.has(o.value)} onChange={() => toggle(o.value)} />
              <span className="truncate" title={o.label}>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
