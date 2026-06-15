"use client";

import { useState } from "react";
import { createPortFromForm } from "@/lib/masterdata/port-form-actions";

export function PortForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createPortFromForm(fd);
        if (res.ok) {
          setMessage("Port created");
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
          placeholder="Port name"
          required
          aria-label="Port name"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Country
        <input
          name="country"
          placeholder="Country (optional)"
          aria-label="Port country"
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add port
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
