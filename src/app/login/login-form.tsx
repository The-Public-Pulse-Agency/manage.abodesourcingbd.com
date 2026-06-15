"use client";

import { loginAction } from "@/lib/auth/actions";

export function LoginForm() {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required className="rounded border px-3 py-2" />
      </label>
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Sign in
      </button>
    </form>
  );
}
