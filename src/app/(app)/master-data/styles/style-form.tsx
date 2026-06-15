"use client";

import { useState } from "react";
import { createStyleFromForm } from "@/lib/masterdata/style-form-actions";

type BrandOption = { id: string; name: string; code: string };

export function StyleForm({ brands }: { brands: BrandOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createStyleFromForm(fd);
        setIsError(!res.ok);
        setMessage(res.ok ? "Style created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <select name="brandId" aria-label="Brand" required className="select">
        <option value="">Select brand…</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </select>
      <input
        name="styleCode"
        placeholder="Style code"
        aria-label="Style code"
        required
        className="input"
      />
      <input
        name="name"
        placeholder="Style name"
        aria-label="Style name"
        required
        className="input"
      />
      <input
        name="category"
        placeholder="Category (optional)"
        aria-label="Category"
        className="input"
      />
      <input
        name="composition"
        placeholder="Composition (optional)"
        aria-label="Composition"
        className="input"
      />
      <input
        name="description"
        placeholder="Description (optional)"
        aria-label="Description"
        className="input"
      />
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add style
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
