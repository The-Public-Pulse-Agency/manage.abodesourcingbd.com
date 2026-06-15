"use client";

import { useState } from "react";
import { createSizeScaleFromForm } from "@/lib/masterdata/size-scale-form-actions";

export function SizeScaleForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createSizeScaleFromForm(fd);
        setIsError(!res.ok);
        setMessage(res.ok ? "Size scale created" : res.error);
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
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add size scale
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>
          {message}
        </span>
      )}
    </form>
  );
}
