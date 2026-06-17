"use client";

import { useState } from "react";
import { importOrdersFromUpload } from "@/lib/import/order-import-actions";

export function OrderImportForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={async (fd) => {
        setBusy(true);
        const res = await importOrdersFromUpload(fd);
        setBusy(false);
        if (res.ok) {
          const s = res.summary;
          setMsg({ ok: true, text: `Imported ${s.orders} order(s), ${s.lines} line(s)${s.skipped ? ` · ${s.skipped} skipped` : ""}.${s.errors.length ? " Issues: " + s.errors.join("; ") : ""}` });
        } else setMsg({ ok: false, text: res.error });
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input name="file" type="file" accept=".xlsx" required className="input" />
      <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {busy ? "Importing…" : "Import orders"}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</span>}
    </form>
  );
}
