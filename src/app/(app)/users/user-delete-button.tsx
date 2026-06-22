"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUserFromForm } from "@/lib/users/form-actions";

export function UserDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await deleteUserFromForm(id);
              if (res.ok) router.refresh();
              else { setError(res.error); setConfirming(false); }
            })
          }
          className="text-bad hover:underline disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">Cancel</button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => setConfirming(true)} className="text-bad hover:underline" aria-label={`Delete ${name}`}>
        Delete
      </button>
      {error && <span className="text-bad">{error}</span>}
    </span>
  );
}
