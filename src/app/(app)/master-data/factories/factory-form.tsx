"use client";

import { useState } from "react";
import { factoryTypes } from "@/lib/masterdata/factory";
import { createFactoryFromForm } from "@/lib/masterdata/factory-form-actions";

export function FactoryForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createFactoryFromForm(fd);
        setIsError(!res.ok);
        setMessage(res.ok ? "Factory added" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <input name="name" aria-label="Factory name" placeholder="Factory name" required className="input" />
      <select name="type" aria-label="Factory type" className="select">
        {factoryTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input name="contactName" aria-label="Contact" placeholder="Contact (optional)" className="input" />
      <input name="contactEmail" type="email" aria-label="Contact email" placeholder="Email (optional)" className="input" />
      <input name="contactPhone" aria-label="Contact phone" placeholder="Phone (optional)" className="input" />
      <input name="address" aria-label="Address" placeholder="Address (optional)" className="input min-w-[14rem]" />
      <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
        Add factory
      </button>
      {message && <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>}
    </form>
  );
}
