import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  return (
    <main className="auth-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm overflow-x-auto rounded-xl border border-line bg-surface elevate-lg">
        <div className="border-b border-line bg-gradient-to-br from-surface to-paper px-6 py-5">
          <span className="brand-gradient font-mono text-lg font-bold tracking-tight">Pulse</span>
          <span className="ml-1.5 text-lg font-semibold tracking-tight">OMS</span>
          <p className="mt-0.5 text-xs text-ink-soft">Order &amp; Merchandising SaaS</p>
        </div>
        <div className="p-6">
          {welcome && (
            <p className="mb-4 rounded-sm bg-ok-soft px-3 py-2 text-sm text-ok">
              Company created — sign in with your new admin account.
            </p>
          )}
          <h1 className="mb-5 text-lg font-semibold tracking-tight">Sign in</h1>
          <LoginForm />
          <p className="mt-5 border-t border-line pt-4 text-center text-sm text-ink-soft">
            New here?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">Create a company</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
