// SUPERADMIN is the platform operator (no company); the rest are company-scoped roles.
export const ROLES = ["SUPERADMIN", "ADMIN", "MERCHANDISER", "ACCOUNTS", "MANAGEMENT"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = [
  "users",
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

// Shorthands for common action sets.
const VIEW: Action[] = ["view"];
const CRUD: Action[] = ["view", "create", "edit", "delete"];

type Matrix = Record<Role, Partial<Record<Module, Action[]>>>;

// Mirrors spec §7. Anything absent = no access.
export const PERMISSIONS: Matrix = {
  SUPERADMIN: {
    companies: CRUD,
    packages: CRUD,
  },
  ADMIN: {
    users: CRUD,
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
  },
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

export function can(role: Role, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}
