import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { unreadCount } from "@/lib/notifications/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const unread = await unreadCount({ id: session.user.id, role: session.user.role });
  return (
    <div className="flex min-h-screen bg-paper">
      <AppSidebar
        role={session.user.role}
        name={session.user.name ?? session.user.email ?? ""}
        unread={unread}
      />
      <main className="min-w-0 flex-1 p-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
