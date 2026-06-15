import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactories } from "@/lib/masterdata/factory";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { FactoryForm } from "./factory-form";

type FactoryRow = Awaited<ReturnType<typeof listFactories>>[number];

export default async function FactoriesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const factories = await listFactories(actor, { includeInactive: true });
  const columns: Column<FactoryRow>[] = [
    { header: "Name", cell: (f) => f.name },
    { header: "Code", cell: (f) => f.code },
    { header: "Type", cell: (f) => f.type },
    { header: "Active", cell: (f) => (f.active ? "Yes" : "No") },
  ];
  if (can(actor.role, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (f) => (
        <Link href={`/master-data/factories/${f.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Factories</h1>
      {can(actor.role, "masterData", "create") && <FactoryForm />}
      <MasterDataTable rows={factories} columns={columns} />
    </div>
  );
}
