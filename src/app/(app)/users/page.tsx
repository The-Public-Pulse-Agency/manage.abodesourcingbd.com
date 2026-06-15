import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/users/actions";
import { CreateUserForm } from "./create-user-form";

export default async function UsersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "users", "view")) redirect("/dashboard");

  const users = await listUsers(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      {can(actor.role, "users", "create") && <CreateUserForm />}
      <table className="w-full border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
