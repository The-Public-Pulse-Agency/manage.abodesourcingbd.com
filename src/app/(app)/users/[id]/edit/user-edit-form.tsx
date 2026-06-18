"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateUserFromForm } from "@/lib/users/form-actions";

export function UserEditForm({
  id,
  name,
  email,
  role,
  roles,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateUserFromForm(id, fd);
        if (res.ok) {
          setIsError(false);
          setMessage("User updated");
          router.push("/users");
        } else {
          setIsError(true);
          setMessage(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Email
        <input
          value={email}
          readOnly
          disabled
          aria-label="Email (read only)"
          className="input opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Name
        <input
          name="name"
          placeholder="Full name"
          required
          aria-label="Name"
          defaultValue={name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Role
        <select name="role" required aria-label="Role" defaultValue={role} className="select">
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
        Save changes
      </button>
      <Link href="/users" className="text-sm text-ink-soft hover:underline">
        Cancel
      </Link>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
