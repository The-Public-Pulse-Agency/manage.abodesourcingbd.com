"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Toggle a master-data row's active flag in place. */
export function ActiveToggle({ id, active, action }: { id: string; active: boolean; action: (id: string, active: boolean) => Promise<{ error?: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => { setBusy(true); const r = await action(id, !active); setBusy(false); if (!r.error) router.refresh(); }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50 ${active ? "bg-ok-soft text-ok hover:bg-ok/15" : "bg-line text-ink-soft hover:bg-paper"}`}
      title={active ? "Click to deactivate" : "Click to activate"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-ok" : "bg-ink-soft"}`} />
      {active ? "Active" : "Inactive"}
    </button>
  );
}
