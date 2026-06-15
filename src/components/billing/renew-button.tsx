"use client";

import { useState } from "react";

export function RenewButton({ amountBdt, label }: { amountBdt: number; label?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/eps/checkout", { method: "POST" });
            const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string; error?: string };
            if (res.ok && data.redirectUrl) {
              window.location.href = data.redirectUrl;
              return;
            }
            setError(data.error || "Could not start the payment.");
          } catch {
            setError("Network error starting payment.");
          }
          setPending(false);
        }}
        className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && <span className="spinner" aria-hidden />}
        {pending ? "Redirecting to EPS…" : label ?? `Pay ৳${amountBdt.toLocaleString()} with EPS`}
      </button>
      {error && <span className="text-sm text-bad">{error}</span>}
    </div>
  );
}
