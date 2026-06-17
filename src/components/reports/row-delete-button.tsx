"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";

/** Delete a row via a server action, with two-step confirm + inline error. */
export function RowDeleteButton({ action, id }: { action: (id: string) => Promise<{ error?: string }>; id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <ConfirmButton
        onConfirm={async () => {
          setErr(null);
          const r = await action(id);
          if (r?.error) setErr(r.error);
          else router.refresh();
        }}
        className="text-xs font-medium text-ink-soft hover:text-bad"
      >
        Delete
      </ConfirmButton>
      {err && <span className="max-w-[14rem] truncate text-[0.625rem] text-bad" title={err}>{err}</span>}
    </span>
  );
}
