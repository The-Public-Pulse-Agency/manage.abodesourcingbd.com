"use client";

import { useState } from "react";

/**
 * Two-step inline confirm for destructive actions. First click reveals "Sure? Yes / No";
 * only "Yes" runs onConfirm. Prevents accidental one-click deletes.
 */
export function ConfirmButton({
  onConfirm,
  children,
  className = "",
  prompt = "Sure?",
}: {
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  prompt?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-ink-soft">{prompt}</span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setConfirming(false); } }}
          className="font-semibold text-bad hover:underline disabled:opacity-50"
        >
          {busy ? "…" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">Cancel</button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} className={className}>
      {children}
    </button>
  );
}
