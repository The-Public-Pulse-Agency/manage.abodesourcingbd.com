"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePortFromForm } from "@/lib/masterdata/port-form-actions";

export function PortEditForm({
  id,
  name,
  country,
}: {
  id: string;
  name: string;
  country: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updatePortFromForm(id, fd);
        if (res.ok) {
          setIsError(false);
          setMessage("Port updated");
          router.push("/master-data/ports");
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
          placeholder="Port name"
          required
          aria-label="Port name"
          defaultValue={name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Country
        <input
          name="country"
          placeholder="Country (optional)"
          aria-label="Port country"
          defaultValue={country}
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
        href="/master-data/ports"
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
