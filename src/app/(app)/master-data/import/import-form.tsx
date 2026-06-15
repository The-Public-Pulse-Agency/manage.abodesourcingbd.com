"use client";

import { useState } from "react";
import { importFromUpload } from "@/lib/import/import-form-actions";

export function ImportForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await importFromUpload(fd);
        setMessage(
          res.ok
            ? `Imported: ${res.summary.factories} factories, ${res.summary.buyers} buyers, ${res.summary.brands} brands, ${res.summary.styles} styles`
            : res.error,
        );
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="file" type="file" accept=".xlsx" required className="rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Import master data
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
