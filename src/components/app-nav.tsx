import Link from "next/link";
import { can, type Role } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";

const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1] }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards" },
  { href: "/master-data/factories", label: "Factories", module: "masterData" },
  { href: "/master-data/buyers", label: "Buyers", module: "masterData" },
  { href: "/master-data/styles", label: "Styles", module: "masterData" },
  { href: "/master-data/colours", label: "Colours", module: "masterData" },
  { href: "/master-data/size-scales", label: "Sizes", module: "masterData" },
  { href: "/master-data/import", label: "Import", module: "masterData" },
  { href: "/users", label: "Users", module: "users" },
];

export function AppNav({ role, name }: { role: Role; name: string }) {
  const visible = ITEMS.filter((i) => can(role, i.module, "view"));
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <nav className="flex gap-4">
        {visible.map((i) => (
          <Link key={i.href} href={i.href} className="text-sm font-medium hover:underline">
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">
          {name} · {role}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="rounded border px-2 py-1">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
