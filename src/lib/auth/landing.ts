import { can, type Module, type PermissionMap } from "@/lib/auth/permissions";

/** Priority order for where to drop a user after login / when a page is off-limits. */
const PRIORITY: { path: string; module: Module }[] = [
  { path: "/dashboard", module: "dashboards" },
  { path: "/orders", module: "orders" },
  { path: "/shipments", module: "shipment" },
  { path: "/critical-path", module: "criticalPath" },
  { path: "/finance", module: "finance" },
  { path: "/master-data/factories", module: "masterData" },
  { path: "/users", module: "users" },
  { path: "/roles", module: "roles" },
  { path: "/audit", module: "auditLog" },
];

/**
 * The first page this user is actually allowed to view. Falls back to /account (which any
 * logged-in user can see) so a low-permission role can never get stuck in a redirect loop
 * (e.g. /dashboard → /orders → /dashboard when the role has neither view).
 */
export function landingPath(actor: { role: string; permissions?: PermissionMap | null }): string {
  for (const p of PRIORITY) if (can(actor, p.module, "view")) return p.path;
  return "/account";
}
