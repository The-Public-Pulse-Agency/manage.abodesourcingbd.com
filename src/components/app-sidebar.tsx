"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Role } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";

const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1]; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards", icon: "▦" },
  { href: "/orders", label: "Orders", module: "orders", icon: "▤" },
  { href: "/critical-path", label: "Critical Path", module: "criticalPath", icon: "◷" },
  { href: "/shipments", label: "Shipments", module: "shipment", icon: "⛟" },
  { href: "/finance", label: "Finance", module: "finance", icon: "₿" },
  { href: "/master-data/factories", label: "Factories", module: "masterData", icon: "⌂" },
  { href: "/master-data/buyers", label: "Buyers", module: "masterData", icon: "◑" },
  { href: "/master-data/styles", label: "Styles", module: "masterData", icon: "✂" },
  { href: "/master-data/colours", label: "Colours", module: "masterData", icon: "◐" },
  { href: "/master-data/size-scales", label: "Sizes", module: "masterData", icon: "↔" },
  { href: "/master-data/import", label: "Import", module: "masterData", icon: "⇪" },
  { href: "/users", label: "Users", module: "users", icon: "◍" },
];

export function AppSidebar({ role, name, unread = 0 }: { role: Role; name: string; unread?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = ITEMS.filter((i) => can(role, i.module, "view"));

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
      {visible.map((i) => {
        const active = isActive(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-accent-soft font-semibold text-accent"
                : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
          >
            <span aria-hidden className="w-4 text-center text-[0.95rem] leading-none opacity-80">{i.icon}</span>
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-baseline gap-2 px-5 py-4">
      <span className="font-mono text-base font-bold tracking-tight text-accent">ABD</span>
      <span className="text-sm font-semibold tracking-tight">OMS</span>
    </Link>
  );

  const footer = (
    <div className="border-t border-line px-3 py-3">
      <Link
        href="/notifications"
        onClick={() => setOpen(false)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-current={isActive("/notifications") ? "page" : undefined}
        className={`mb-2 flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
          isActive("/notifications") ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        <span aria-hidden className="w-4 text-center leading-none">🔔</span>
        <span>Notifications</span>
        {unread > 0 && (
          <span className="ml-auto inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-tight text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      <div className="flex items-center justify-between gap-2 px-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="font-mono text-[0.625rem] uppercase tracking-wide text-ink-soft">{role}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-sm border border-line px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-sm border border-line px-2 py-1 text-sm hover:border-accent hover:text-accent"
        >
          ☰
        </button>
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-bold tracking-tight text-accent">ABD</span>
          <span className="text-sm font-semibold tracking-tight">OMS</span>
        </Link>
        <Link href="/notifications" aria-label="Notifications" className="relative text-ink-soft hover:text-accent">
          <span aria-hidden className="text-lg leading-none">🔔</span>
          {unread > 0 && (
            <span className="absolute -right-2 -top-1.5 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-tight text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-surface shadow-xl">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
