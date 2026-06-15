"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateForwarderFromForm } from "@/lib/masterdata/forwarder-form-actions";

export function ForwarderEditForm({
  id,
  name,
  contact,
}: {
  id: string;
  name: string;
  contact: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateForwarderFromForm(id, fd);
        if (res.ok) {
          setIsError(false);
          setMessage("Forwarder updated");
          router.push("/master-data/forwarders");
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
          placeholder="Forwarder name"
          required
          aria-label="Forwarder name"
          defaultValue={name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Contact
        <input
          name="contact"
          placeholder="Contact (optional)"
          aria-label="Forwarder contact"
          defaultValue={contact}
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
        href="/master-data/forwarders"
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
