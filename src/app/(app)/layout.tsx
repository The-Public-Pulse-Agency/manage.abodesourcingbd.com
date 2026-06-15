import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={session.user.role} name={session.user.name ?? session.user.email ?? ""} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
