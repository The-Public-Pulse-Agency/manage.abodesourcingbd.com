"use client";

import { useState } from "react";
import { changePasswordAction } from "@/lib/users/password-actions";

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        const res = await changePasswordAction(fd);
        setPending(false);
        setMsg(res);
        if (res.ok) (document.getElementById("pw-form") as HTMLFormElement | null)?.reset();
      }}
      id="pw-form"
      className="max-w-sm space-y-3"
    >
      <label className="block">
        <span className="eyebrow">Current password</span>
        <input name="currentPassword" type="password" required className="input mt-1 w-full" autoComplete="current-password" />
      </label>
      <label className="block">
        <span className="eyebrow">New password</span>
        <input name="newPassword" type="password" required minLength={8} className="input mt-1 w-full" autoComplete="new-password" placeholder="At least 8 characters" />
      </label>
      {msg?.error && <p className="text-sm text-bad">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-ok">Password updated.</p>}
      <button type="submit" disabled={pending} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
