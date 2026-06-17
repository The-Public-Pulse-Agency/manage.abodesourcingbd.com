"use client";

import { useState } from "react";
import { ASSIGNABLE_ROLES as ROLES } from "@/lib/auth/permissions";
import { createUserFromForm } from "@/lib/users/form-actions";

export function CreateUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createUserFromForm(fd);
        if (res.ok) {
          setMessage("User created");
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
        <input name="name" placeholder="Name" required aria-label="Name" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Email
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          aria-label="Email"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Password
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          aria-label="Password"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Role
        <select name="role" required aria-label="Role" className="select">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Add user
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
