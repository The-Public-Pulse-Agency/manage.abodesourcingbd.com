"use client";

import { useState } from "react";
import { createForwarderFromForm } from "@/lib/masterdata/forwarder-form-actions";

export function ForwarderForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createForwarderFromForm(fd);
        if (res.ok) {
          setMessage("Forwarder created");
          setIsError(false);
        } else {
          setMessage(res.error);
          setIsError(true);
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
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Contact
        <input
          name="contact"
          placeholder="Contact (optional)"
          aria-label="Forwarder contact"
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add forwarder
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
