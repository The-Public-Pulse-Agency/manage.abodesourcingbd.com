"use client";

import { loginAction } from "@/lib/auth/actions";

export function LoginForm() {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input name="email" type="email" required autoComplete="username" className="input w-full" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Password
        <input name="password" type="password" required autoComplete="current-password" className="input w-full" />
      </label>
      <button type="submit" className="btn-brand mt-1 w-full px-3 py-2.5 text-sm">Sign in</button>
    </form>
  );
}
