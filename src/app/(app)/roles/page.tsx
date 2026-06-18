import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listRoles } from "@/lib/auth/roles";
import { RoleManager, type RoleRow } from "@/components/settings/role-manager";

export default async function RolesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "roles", "view")) redirect("/dashboard");
  const roles: RoleRow[] = await listRoles(actor);
  const canManage = can(actor, "roles", "edit");

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; permissions</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Create roles and grant each module the actions it needs. Assign roles to users on the
          Users page. System roles can be re-permissioned but not deleted.
        </p>
      </div>
      <RoleManager roles={roles} canManage={canManage} />
    </div>
  );
}
