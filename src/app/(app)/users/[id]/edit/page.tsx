import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getUser } from "@/lib/users/actions";
import { assignableRoles } from "@/lib/auth/roles";
import { UserEditForm } from "./user-edit-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "users", "edit")) redirect("/dashboard");
  const [user, roles] = await Promise.all([getUser(actor, id), assignableRoles(actor)]);
  if (!user) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <UserEditForm id={user.id} name={user.name} email={user.email} role={user.role} roles={roles} />
    </div>
  );
}
