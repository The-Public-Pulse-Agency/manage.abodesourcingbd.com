import { type SessionUser } from "@/lib/auth/guard";

/**
 * Platform-operator gate. The platform console operates across ALL tenants with no
 * companyId scoping, so it must be reachable ONLY by a genuine platform operator:
 * a SUPERADMIN that belongs to no company. This enforces the invariant that a
 * tenant-scoped account (companyId != null) can never act on the platform, even if
 * its role were somehow SUPERADMIN — defence in depth behind the role-assignment guard.
 */
export function assertPlatformOperator(actor: SessionUser): void {
  if (actor.role !== "SUPERADMIN" || actor.companyId != null) {
    throw new Error("Forbidden: platform access requires a SUPERADMIN with no tenant");
  }
}
