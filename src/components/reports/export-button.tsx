"use client";

import { useState } from "react";

type Base = { filename: string; headers: string[] };
type Props =
  | (Base & { rows: (string | number)[][]; action?: never; actionArg?: never })
  | (Base & { rows?: never; action: (arg: unknown) => Promise<(string | number)[][]>; actionArg: unknown });

/** CSV export — either given pre-built rows, or fetches all (filtered) rows via a server action. */
export function ExportButton({ filename, headers, rows, action, actionArg }: Props) {
  const [busy, setBusy] = useState(false);

  function toCsv(data: (string | number)[][]) {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...data].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onClick() {
    if (rows) return toCsv(rows);
    setBusy(true);
    try {
      toCsv(await action!(actionArg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || (rows && rows.length === 0)}
      className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {busy ? <span className="spinner" /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>}
      Export CSV
    </button>
  );
}
