"use client";

import { useState } from "react";
import { createBuyerFromForm, createBrandFromForm } from "@/lib/masterdata/buyer-form-actions";

export function BuyerForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createBuyerFromForm(fd);
        setError(!res.ok);
        setMessage(res.ok ? "Buyer created" : res.error);
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
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add buyer
      </button>
      {message && (
        <span className={`text-sm ${error ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}

export function BrandForm({ buyers }: { buyers: { id: string; name: string }[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createBrandFromForm(fd);
        setError(!res.ok);
        setMessage(res.ok ? "Brand created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Buyer</span>
        <select name="buyerId" aria-label="Buyer" required className="select" defaultValue="">
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
          className="input"
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add brand
      </button>
      {message && (
        <span className={`text-sm ${error ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
