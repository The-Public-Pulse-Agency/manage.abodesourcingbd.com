import Link from "next/link";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="auth-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm overflow-x-auto rounded-xl border border-line bg-surface elevate-lg">
        <div className="border-b border-line bg-gradient-to-br from-surface to-paper px-6 py-5">
          <span className="brand-gradient font-mono text-lg font-bold tracking-tight">Pulse</span>
          <span className="ml-1.5 text-lg font-semibold tracking-tight">OMS</span>
          <p className="mt-0.5 text-xs text-ink-soft">Start your buying-house workspace</p>
        </div>
        <div className="p-6">
          <h1 className="mb-5 text-lg font-semibold tracking-tight">Create your company</h1>
          <SignUpForm />
          <p className="mt-5 border-t border-line pt-4 text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
