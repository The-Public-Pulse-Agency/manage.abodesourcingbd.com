"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Role, type PermissionMap } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";
import { BrandMark } from "@/components/brand-mark";

const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1]; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards", icon: "▦" },
  { href: "/reports/open-orders", label: "Running Orders", module: "orders", icon: "▥" },
  { href: "/reports/shipped", label: "Shipped Goods", module: "shipment", icon: "✔" },
  { href: "/reports/factories", label: "Factory Info", module: "masterData", icon: "❖" },
  { href: "/reports/development", label: "Development", module: "orders", icon: "⚗" },
  { href: "/reports/commission", label: "Buyer Commission", module: "finance", icon: "％" },
  { href: "/reports/buyer-samples", label: "Buyer Samples", module: "sampling", icon: "✉" },
  { href: "/reports/sample-ledger", label: "Sample In/Out", module: "sampling", icon: "⇄" },
  { href: "/enquiries", label: "Enquiries", module: "orders", icon: "✎" },
  { href: "/orders", label: "Orders", module: "orders", icon: "▤" },
  { href: "/critical-path", label: "Critical Path", module: "criticalPath", icon: "◷" },
  { href: "/shipments", label: "Shipments", module: "shipment", icon: "⛟" },
  { href: "/finance", label: "Finance", module: "finance", icon: "₿" },
  { href: "/master-data/factories", label: "Factories", module: "masterData", icon: "⌂" },
  { href: "/master-data/buyers", label: "Buyers", module: "masterData", icon: "◑" },
  { href: "/master-data/brands", label: "Brands", module: "masterData", icon: "✦" },
  { href: "/master-data/styles", label: "Styles", module: "masterData", icon: "✂" },
  { href: "/master-data/colours", label: "Colours", module: "masterData", icon: "◐" },
  { href: "/master-data/size-scales", label: "Sizes", module: "masterData", icon: "↔" },
  { href: "/master-data/ports", label: "Ports", module: "masterData", icon: "⚓" },
  { href: "/master-data/forwarders", label: "Forwarders", module: "masterData", icon: "✈" },
  { href: "/master-data/import", label: "Import", module: "masterData", icon: "⇪" },
  { href: "/users", label: "Users", module: "users", icon: "◍" },
  { href: "/roles", label: "Roles", module: "roles", icon: "⚷" },
  { href: "/audit", label: "Activity Log", module: "auditLog", icon: "❑" },
];

export function AppSidebar({ role, permissions, name, unread = 0 }: { role: Role; permissions?: PermissionMap | null; name: string; unread?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const actor = { role, permissions };
  const visible = ITEMS.filter((i) => can(actor, i.module, "view"));

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
            className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
              active
                ? "bg-gradient-to-r from-accent-soft to-transparent font-semibold text-accent shadow-[inset_0_0_0_1px_rgba(211,47,47,0.12)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
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
      <BrandMark size="base" />
    </Link>
  );

  const footer = (
    <div className="border-t border-line px-3 py-3">
      {can(actor, "criticalPath", "edit") && (
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          aria-current={isActive("/settings") ? "page" : undefined}
          className={`mb-2 flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
            isActive("/settings") ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"
          }`}
        >
          <span aria-hidden className="w-4 text-center leading-none">⚙</span>
          <span>Settings</span>
        </Link>
      )}
      {role === "ADMIN" && (
        <Link
          href="/billing"
          onClick={() => setOpen(false)}
          aria-current={isActive("/billing") ? "page" : undefined}
          className={`mb-2 flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
            isActive("/billing") ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"
          }`}
        >
          <span aria-hidden className="w-4 text-center leading-none">₿</span>
          <span>Billing</span>
        </Link>
      )}
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
        <Link href="/account" onClick={() => setOpen(false)} className="min-w-0 rounded-sm hover:text-accent" aria-label="My account">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="font-mono text-[0.625rem] uppercase tracking-wide text-ink-soft">{role}</p>
        </Link>
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
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-line px-4 py-2 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-sm border border-line px-2 py-1 text-sm hover:border-accent hover:text-accent"
        >
          ☰
        </button>
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <BrandMark size="sm" />
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
      <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line md:flex">
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
          <aside className="glass absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line shadow-2xl">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
