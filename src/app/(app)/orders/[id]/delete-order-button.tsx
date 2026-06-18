"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAction } from "@/lib/reports/inline-actions";

/** Delete a (draft) purchase order, then return to the order book. Two-step confirm. */
export function DeleteOrderButton({ poId }: { poId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setErr(null);
    const r = await deleteOrderAction(poId);
    if (r.error) {
      setErr(r.error);
      setBusy(false);
      setConfirming(false);
    } else {
      router.push("/reports/open-orders");
      router.refresh();
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-bad hover:text-bad"
      >
        Delete order
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-bad">Delete this order?</span>
      <button type="button" disabled={busy} onClick={del} className="rounded-sm bg-bad px-2 py-1 font-medium text-white disabled:opacity-50">
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft hover:text-accent">Cancel</button>
      {err && <span className="text-bad">{err}</span>}
    </span>
  );
}
