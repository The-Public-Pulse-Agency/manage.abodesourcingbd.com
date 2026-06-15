import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getUser } from "@/lib/users/actions";
import { UserEditForm } from "./user-edit-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "users", "edit")) redirect("/dashboard");
  const user = await getUser(actor, id);
  if (!user) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <UserEditForm id={user.id} name={user.name} email={user.email} role={user.role} />
    </div>
  );
}
