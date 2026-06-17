"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearAllDataAction } from "@/lib/import/order-import-actions";

export function DangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const armed = confirm === "DELETE ALL";

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Permanently delete <strong>all orders and shipments</strong> (with their lines, milestones, invoices &amp;
        payments). Master data — buyers, factories, styles, colours — is kept. Use this to wipe mistaken data before
        a clean re-import. <strong className="text-bad">This cannot be undone.</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE ALL to confirm"
          className="input min-w-[14rem]"
          aria-label="Confirm phrase"
        />
        <button
          type="button"
          disabled={!armed || busy}
          onClick={async () => {
            setBusy(true);
            const r = await clearAllDataAction(confirm);
            setBusy(false);
            if (r.ok) { setMsg({ ok: true, text: `Cleared ${r.orders} order(s) and ${r.shipments} shipment(s).` }); setConfirm(""); router.refresh(); }
            else setMsg({ ok: false, text: r.error });
          }}
          className="rounded-sm bg-bad px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Clearing…" : "Delete all orders & shipments"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
