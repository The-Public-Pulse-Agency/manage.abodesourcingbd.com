import Link from "next/link";
import { can, type Role } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";

const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1] }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards" },
  { href: "/orders", label: "Orders", module: "orders" },
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
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-bold tracking-tight text-accent">ABD</span>
            <span className="text-sm font-semibold tracking-tight">OMS</span>
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {visible.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="text-sm text-ink-soft transition-colors hover:text-accent"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-soft">
            {name} · <span className="font-mono text-xs uppercase">{role}</span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-sm border border-line px-2.5 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
