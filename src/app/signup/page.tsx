import Link from "next/link";
import { BrandMark, BrandBadge } from "@/components/brand-mark";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="auth-mesh flex min-h-screen items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm rounded-2xl p-7">
        <div className="flex flex-col items-center text-center">
          <BrandBadge className="h-12 w-12 text-sm" />
          <div className="mt-3"><BrandMark size="lg" tagline="Order & Merchandising" /></div>
        </div>
        <h1 className="mt-6 mb-4 text-lg font-semibold tracking-tight">Create your company</h1>
        <SignUpForm />
        <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
