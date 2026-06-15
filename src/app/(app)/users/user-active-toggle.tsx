"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserActiveFromForm } from "@/lib/users/form-actions";

export function UserActiveToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await setUserActiveFromForm(id, !active);
            if (res.ok) {
              router.refresh();
            } else {
              setError(res.error);
            }
          })
        }
        className="text-accent hover:underline disabled:opacity-50"
      >
        {active ? "Deactivate" : "Activate"}
      </button>
      {error && <span className="text-bad">{error}</span>}
    </span>
  );
}
