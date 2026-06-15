"use client";

import { useState } from "react";
import { factoryTypes } from "@/lib/masterdata/factory";
import { createFactoryFromForm } from "@/lib/masterdata/factory-form-actions";

export function FactoryForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await createFactoryFromForm(fd);
        setMessage(res.ok ? "Factory created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="name" placeholder="Factory name" required className="rounded border px-3 py-2" />
      <select name="type" className="rounded border px-3 py-2">
        {factoryTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input name="contactName" placeholder="Contact (optional)" className="rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Add factory
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
