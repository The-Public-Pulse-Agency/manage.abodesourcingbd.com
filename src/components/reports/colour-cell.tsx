"use client";

import { useState } from "react";

/**
 * Compact colour cell: shows the first `max` colours and collapses the rest under a
 * "+N more" toggle (click to expand/collapse; hover shows the full list). Keeps the
 * COLOUR column from ballooning when a style has many colours.
 */
export function ColourCell({ value, max = 2 }: { value: string; max?: number }) {
  const [open, setOpen] = useState(false);
  const parts = value && value !== "—" ? value.split(", ").filter(Boolean) : [];
  if (parts.length === 0) return <span className="text-ink-soft">—</span>;
  if (parts.length <= max) return <span>{parts.join(", ")}</span>;

  if (open) {
    return (
      <span className="inline-block max-w-[16rem] whitespace-normal">
        {parts.join(", ")}{" "}
        <button type="button" onClick={() => setOpen(false)} className="text-[0.625rem] font-semibold text-accent hover:underline">less</button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" title={parts.join(", ")}>
      <span>{parts.slice(0, max).join(", ")}</span>
      <button type="button" onClick={() => setOpen(true)} className="rounded-sm bg-paper px-1 py-0.5 text-[0.625rem] font-semibold text-accent hover:underline">+{parts.length - max} more</button>
    </span>
  );
}
