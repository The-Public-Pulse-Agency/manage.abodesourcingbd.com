import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangePasswordForm } from "./account-form";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5 elevate">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Profile</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Name</dt><dd className="font-medium">{session.user.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Email</dt><dd className="font-medium">{session.user.email}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Role</dt><dd className="font-mono text-xs uppercase">{session.user.role}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 elevate">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Change password</h3>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
