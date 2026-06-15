"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmAction,
  removeLineAction,
  createAndAssignLotAction,
} from "@/lib/orders/form-actions";

export function ConfirmButton({ poId }: { poId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          setPending(true);
          setError(null);
          const r = await confirmAction(poId);
          setPending(false);
          if (r.error) setError(r.error);
          else router.refresh();
        }}
        disabled={pending}
        className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Confirming…" : "Confirm order"}
      </button>
      {error && <span className="text-sm text-bad">{error}</span>}
    </div>
  );
}

export function RemoveLineButton({ poId, lineId }: { poId: string; lineId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setPending(true);
        const r = await removeLineAction(poId, lineId);
        setPending(false);
        if (!r.error) router.refresh();
      }}
      disabled={pending}
      className="text-xs text-ink-soft transition-colors hover:text-bad disabled:opacity-50"
      title="Remove line"
    >
      Remove
    </button>
  );
}

export function LotWidget({ poId, factoryId }: { poId: string; factoryId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">New lot name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="e.g. LOT-JUN-1"
        />
      </label>
      <button
        type="button"
        onClick={async () => {
          if (!name.trim()) return;
          setPending(true);
          setError(null);
          const r = await createAndAssignLotAction(poId, name.trim(), factoryId);
          setPending(false);
          if (r.error) setError(r.error);
          else {
            setName("");
            router.refresh();
          }
        }}
        disabled={pending}
        className="rounded-sm border border-ink px-3 py-2 text-sm font-medium transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
      >
        {pending ? "…" : "Create + assign"}
      </button>
      {error && <span className="self-center text-sm text-bad">{error}</span>}
    </div>
  );
}
