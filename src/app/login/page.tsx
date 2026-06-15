import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-line bg-surface elevate-lg">
        <div className="border-b border-line bg-paper px-6 py-4">
          <span className="font-mono text-base font-bold tracking-tight text-accent">Pulse</span>
          <span className="ml-1.5 text-base font-semibold tracking-tight">OMS</span>
          <p className="mt-0.5 text-xs text-ink-soft">Order &amp; Merchandising SaaS</p>
        </div>
        <div className="p-6">
          <h1 className="mb-5 text-lg font-semibold tracking-tight">Sign in</h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
