"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateBrandFromForm } from "@/lib/masterdata/buyer-form-actions";

export function BrandEditForm({
  brand,
  buyers,
}: {
  brand: { id: string; buyerId: string; name: string; code: string };
  buyers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateBrandFromForm(brand.id, fd);
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
        <span className="text-ink-soft">Buyer</span>
        <select
          name="buyerId"
          aria-label="Buyer"
          required
          className="select"
          defaultValue={brand.buyerId}
        >
          <option value="" disabled>
            Select buyer
          </option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Brand name</span>
        <input
          name="name"
          placeholder="Brand name"
          aria-label="Brand name"
          required
          defaultValue={brand.name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Brand code</span>
        <input
          name="code"
          placeholder="Brand code"
          aria-label="Brand code"
          required
          defaultValue={brand.code}
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
