import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome, {session?.user?.name}. Role: {session?.user?.role}.
      </p>
    </div>
  );
}
