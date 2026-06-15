"use client";

import { useState } from "react";
import { ROLES } from "@/lib/auth/permissions";
import { createUserFromForm } from "@/lib/users/form-actions";

export function CreateUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await createUserFromForm(fd);
        setMessage(res.ok ? "User created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="name" placeholder="Name" required className="rounded border px-3 py-2" />
      <input name="email" type="email" placeholder="Email" required className="rounded border px-3 py-2" />
      <input name="password" type="password" placeholder="Password" required className="rounded border px-3 py-2" />
      <select name="role" required className="rounded border px-3 py-2">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Add user
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
