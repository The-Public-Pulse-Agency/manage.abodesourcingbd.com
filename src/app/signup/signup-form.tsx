"use client";

import { useState, useTransition } from "react";
import { signUpAction } from "@/lib/signup/form-actions";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        const res = await signUpAction(fd);
        if (res?.error) setError(res.error);
      })}
      className="space-y-3"
    >
      <Field label="Company name"><input name="companyName" required className="input w-full" placeholder="e.g. Acme Sourcing" /></Field>
      <Field label="Your name"><input name="name" required className="input w-full" placeholder="Full name" /></Field>
      <Field label="Work email"><input name="email" type="email" required className="input w-full" placeholder="you@company.com" /></Field>
      <Field label="Password"><input name="password" type="password" required minLength={8} className="input w-full" placeholder="At least 8 characters" /></Field>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? "Creating…" : "Create company & start free trial"}
      </button>
      <p className="text-center text-xs text-ink-soft">30-day free trial · no card required</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
