"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateColourFromForm } from "@/lib/masterdata/colour-form-actions";

export function ColourEditForm({
  id,
  name,
  code,
}: {
  id: string;
  name: string;
  code: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateColourFromForm(id, fd);
        if (res.ok) {
          setIsError(false);
          setMessage("Colour updated");
          router.push("/master-data/colours");
        } else {
          setIsError(true);
          setMessage(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Name
        <input
          name="name"
          placeholder="Colour name"
          required
          aria-label="Colour name"
          defaultValue={name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Code
        <input
          name="code"
          placeholder="Code (optional)"
          aria-label="Colour code"
          defaultValue={code}
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
        href="/master-data/colours"
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
