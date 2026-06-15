import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/users/actions";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { CreateUserForm } from "./create-user-form";
import { UserActiveToggle } from "./user-active-toggle";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export default async function UsersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "users", "view")) redirect("/dashboard");

  const users = await listUsers(actor);
  const columns: Column<UserRow>[] = [
    { header: "Name", cell: (u) => u.name },
    { header: "Email", cell: (u) => u.email },
    { header: "Role", cell: (u) => u.role },
    { header: "Active", cell: (u) => (u.active ? "Yes" : "No") },
  ];
  if (can(actor.role, "users", "edit")) {
    columns.push({
      header: "Actions",
      align: "right",
      cell: (u) => (
        <span className="inline-flex items-center gap-3">
          <Link href={`/users/${u.id}/edit`} className="text-accent hover:underline">
            Edit
          </Link>
          <UserActiveToggle id={u.id} active={u.active} />
        </span>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      {can(actor.role, "users", "create") && <CreateUserForm />}
      <MasterDataTable rows={users} columns={columns} empty="No users yet." />
    </div>
  );
}
