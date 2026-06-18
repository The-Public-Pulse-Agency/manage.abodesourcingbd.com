// Roles are dynamic, per-company rows (model Role) with a granular permission map.
// A role is identified by a string KEY. SUPERADMIN is the special platform-operator key
// (no company). The keys below are the SYSTEM roles seeded into every company by default.
export const SYSTEM_ROLE_KEYS = ["ADMIN", "MERCHANDISER", "ACCOUNTS", "MANAGEMENT"] as const;
export const SUPERADMIN_KEY = "SUPERADMIN";

// Back-compat: the full set of seeded keys (platform + company system roles).
export const ROLES = [SUPERADMIN_KEY, ...SYSTEM_ROLE_KEYS] as const;

// A role key is now any string (custom roles allowed). Kept as a named alias for readability.
export type Role = string;

export const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = [
  "users",
  "roles",
  "masterData",
  "orders",
  "criticalPath",
  "sampling",
  "productionQc",
  "costing",
  "shipment",
  "documents",
  "finance",
  "dashboards",
  "auditLog",
  // Platform (SUPERADMIN only):
  "companies",
  "packages",
] as const;
export type Module = (typeof MODULES)[number];

/** Modules a company role may be granted (platform modules are SUPERADMIN-only). */
export const COMPANY_MODULES = MODULES.filter((m) => m !== "companies" && m !== "packages") as Exclude<Module, "companies" | "packages">[];

/** Human labels for modules (Role Manager matrix display). */
export const MODULE_LABELS: Record<string, string> = {
  users: "Users",
  roles: "Roles",
  masterData: "Master data",
  orders: "Orders",
  criticalPath: "Critical path",
  sampling: "Sampling",
  productionQc: "Production / QC",
  costing: "Costing",
  shipment: "Shipment",
  documents: "Documents",
  finance: "Finance",
  dashboards: "Dashboards",
  auditLog: "Audit log",
  companies: "Companies",
  packages: "Packages",
};

export type PermissionMap = Partial<Record<Module, Action[]>>;

// Shorthands for common action sets.
const VIEW: Action[] = ["view"];
const CRUD: Action[] = ["view", "create", "edit", "delete"];

/**
 * Default permission maps for the seeded roles (mirrors spec §7). New companies are seeded
 * with these; afterwards each company's roles are fully editable via the Role Manager.
 * SUPERADMIN is the platform operator and is resolved from here (never a tenant Role row).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionMap> = {
  SUPERADMIN: {
    companies: CRUD,
    packages: CRUD,
  },
  ADMIN: {
    users: CRUD,
    roles: CRUD,
    masterData: CRUD,
    orders: CRUD,
    criticalPath: CRUD,
    sampling: CRUD,
    productionQc: CRUD,
    costing: ["view", "create", "edit", "delete", "approve"],
    shipment: CRUD,
    documents: CRUD,
    finance: CRUD,
    dashboards: VIEW,
    auditLog: VIEW,
  } as PermissionMap,
  MERCHANDISER: {
    masterData: ["view", "create", "edit"],
    orders: CRUD,
    criticalPath: CRUD,
    sampling: CRUD,
    productionQc: CRUD,
    costing: ["view", "create", "edit"],
    shipment: CRUD,
    documents: CRUD,
    finance: VIEW,
    dashboards: VIEW,
  },
  ACCOUNTS: {
    masterData: VIEW,
    orders: VIEW,
    criticalPath: VIEW,
    productionQc: VIEW,
    costing: ["view", "create", "edit", "delete", "approve"],
    shipment: VIEW,
    documents: ["view", "create", "edit"],
    finance: CRUD,
    dashboards: VIEW,
  },
  MANAGEMENT: {
    users: VIEW,
    masterData: VIEW,
    orders: VIEW,
    criticalPath: VIEW,
    sampling: VIEW,
    productionQc: VIEW,
    costing: VIEW,
    shipment: VIEW,
    documents: VIEW,
    finance: VIEW,
    dashboards: VIEW,
    auditLog: VIEW,
  },
};

/** Human labels for the system roles (display only; custom roles carry their own name). */
export const SYSTEM_ROLE_NAMES: Record<string, string> = {
  ADMIN: "Admin",
  MERCHANDISER: "Merchandiser",
  ACCOUNTS: "Accounts",
  MANAGEMENT: "Management",
};

/** Low-level check against a resolved permission map. */
export function mapAllows(perms: PermissionMap | undefined | null, module: Module, action: Action): boolean {
  return perms?.[module]?.includes(action) ?? false;
}

/**
 * Authorization check for an actor. The actor carries its resolved `permissions` map (loaded
 * from its Role row at session time); if absent we fall back to the role's seeded defaults so
 * pure unit tests and the SUPERADMIN platform path keep working without a DB round-trip.
 */
export function can(
  actor: { role: Role; permissions?: PermissionMap | null } | null | undefined,
  module: Module,
  action: Action,
): boolean {
  if (!actor) return false;
  const perms = actor.permissions ?? DEFAULT_ROLE_PERMISSIONS[actor.role];
  return mapAllows(perms, module, action);
}
