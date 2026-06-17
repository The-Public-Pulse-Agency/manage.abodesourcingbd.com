"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  raw: string; // current value as an input string ("" when empty)
  action: (id: string, value: string) => Promise<{ error?: string }>;
  type?: "text" | "number" | "date";
  align?: "left" | "right";
  placeholder?: string;
  children: React.ReactNode; // formatted display
};

/** Click-to-edit table cell: commits on Enter/blur, Esc cancels, then refreshes data. */
export function EditableCell({ id, raw, action, type = "text", align = "left", placeholder = "—", children }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    setEditing(false);
    if (draft === raw) return;
    setBusy(true);
    setErr(false);
    const res = await action(id, draft);
    setBusy(false);
    if (res.error) { setErr(true); setDraft(raw); return; }
    router.refresh();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={type === "number" ? "0.0001" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(raw); setEditing(false); } }}
        className={`w-full rounded-sm border border-accent bg-surface px-1.5 py-0.5 text-xs outline-none ${align === "right" ? "text-right" : ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(raw); setEditing(true); }}
      title="Click to edit"
      className={`group/edit -mx-1 flex w-full items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-accent-soft ${align === "right" ? "justify-end" : ""} ${err ? "ring-1 ring-bad" : ""}`}
    >
      <span className={raw ? "" : "text-ink-soft"}>{busy ? <span className="spinner" /> : (raw ? children : placeholder)}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-soft opacity-0 transition-opacity group-hover/edit:opacity-100"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
    </button>
  );
}
