import { can, type Action, type Module, type Role } from "./permissions";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = { id: string; role: Role; companyId?: string | null };

/**
 * The tenant a query must be scoped to. Every OMS lib operation runs in a company
 * context; throws if there is none (the platform SUPERADMIN never runs OMS queries).
 * Use in EVERY query: `where: { companyId: tenantId(actor), ... }` and on create
 * `data: { companyId: tenantId(actor), ... }`.
 */
export function tenantId(actor: SessionUser): string {
  if (!actor.companyId) throw new ForbiddenError("No company context for this operation");
  return actor.companyId;
}

/** Pure authorization check — throws if the user may not perform the action. */
export function assertPermission(
  user: SessionUser | null | undefined,
  module: Module,
  action: Action,
): SessionUser {
  if (!user) throw new ForbiddenError("Not authenticated");
  if (!can(user.role, module, action)) {
    throw new ForbiddenError(`${user.role} cannot ${action} ${module}`);
  }
  return user;
}

/**
 * Reads the current session user (or null). For use inside server actions.
 * `auth` is imported lazily so pure unit tests of assertPermission do not load
 * the next-auth runtime.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user) return null;
  return { id: session.user.id, role: session.user.role, companyId: session.user.companyId ?? null };
}

/** Session-aware guard for server actions: loads the user and asserts. */
export async function requirePermission(
  module: Module,
  action: Action,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  return assertPermission(user, module, action);
}
