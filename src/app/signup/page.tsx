import Link from "next/link";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-line bg-surface elevate-lg">
        <div className="border-b border-line bg-paper px-6 py-4">
          <span className="font-mono text-base font-bold tracking-tight text-accent">Pulse</span>
          <span className="ml-1.5 text-base font-semibold tracking-tight">OMS</span>
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
