"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Short-close an order from a report row: two-step confirm, inline error. The remaining
 * un-shipped balance is recorded as short-shipped and the order drops off the open book.
 */
export function RowCloseButton({ action, id }: { action: (id: string) => Promise<{ error?: string }>; id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-ink-soft">Close (short-ship rest)?</span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const r = await action(id);
            setBusy(false);
            if (r?.error) { setErr(r.error); setConfirming(false); }
            else router.refresh();
          }}
          className="font-semibold text-accent hover:underline disabled:opacity-50"
        >
          {busy ? "…" : "Yes, close"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">Cancel</button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => setConfirming(true)} className="text-xs font-medium text-ink-soft hover:text-accent">
        Close
      </button>
      {err && <span className="max-w-[14rem] truncate text-[0.625rem] text-bad" title={err}>{err}</span>}
    </span>
  );
}
