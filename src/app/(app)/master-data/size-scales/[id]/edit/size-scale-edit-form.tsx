"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSizeScaleFromForm } from "@/lib/masterdata/size-scale-form-actions";

export function SizeScaleEditForm({
  id,
  name,
  sizes,
}: {
  id: string;
  name: string;
  sizes: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateSizeScaleFromForm(id, fd);
        if (res.ok) {
          setIsError(false);
          setMessage("Size scale updated");
          router.push("/master-data/size-scales");
        } else {
          setIsError(true);
          setMessage(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        <span>Scale name</span>
        <input
          name="name"
          placeholder="e.g. Mens Tops"
          required
          aria-label="Scale name"
          defaultValue={name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        <span>Sizes (comma-separated, in order)</span>
        <input
          name="sizes"
          placeholder="e.g. XS, S, M, L, XL"
          required
          aria-label="Sizes (comma-separated, in order)"
          defaultValue={sizes}
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Save changes
      </button>
      <Link
        href="/master-data/size-scales"
        className="text-sm text-ink-soft hover:underline"
      >
        Cancel
      </Link>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
