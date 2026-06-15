"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateBuyerFromForm } from "@/lib/masterdata/buyer-form-actions";

export function BuyerEditForm({
  buyer,
}: {
  buyer: { id: string; name: string };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateBuyerFromForm(buyer.id, fd);
        if (res.ok) {
          router.push("/master-data/buyers");
        } else {
          setIsError(true);
          setMessage(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Buyer name</span>
        <input
          name="name"
          placeholder="Buyer name"
          aria-label="Buyer name"
          required
          defaultValue={buyer.name}
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Save changes
      </button>
      <Link href="/master-data/buyers" className="text-sm text-ink-soft hover:underline">
        Cancel
      </Link>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
