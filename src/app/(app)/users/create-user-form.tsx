"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserFromForm } from "@/lib/users/form-actions";

export function CreateUserForm({ roles }: { roles: { key: string; name: string }[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await createUserFromForm(fd);
        if (res.ok) {
          setMessage("User created");
          setIsError(false);
          (document.getElementById("create-user-form") as HTMLFormElement | null)?.reset();
          router.refresh(); // re-render the server list so the new user appears immediately
        } else {
          setMessage(res.error);
          setIsError(true);
        }
      }}
      id="create-user-form"
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
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
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
