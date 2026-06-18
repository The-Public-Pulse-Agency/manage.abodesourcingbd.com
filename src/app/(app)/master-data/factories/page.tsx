import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactories } from "@/lib/masterdata/factory";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { ActiveToggle } from "@/components/master-data/active-toggle";
import { setFactoryActiveAction } from "@/lib/masterdata/active-form-actions";
import { deleteFactoryAction } from "@/lib/masterdata/delete-form-actions";
import { FactoryForm } from "./factory-form";

type FactoryRow = Awaited<ReturnType<typeof listFactories>>[number];

export default async function FactoriesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "masterData", "view")) redirect("/dashboard");
  const factories = await listFactories(actor, { includeInactive: true });
  const columns: Column<FactoryRow>[] = [
    { header: "Name", cell: (f) => f.name },
    { header: "Code", cell: (f) => f.code },
    { header: "Type", cell: (f) => f.type },
    { header: "Active", cell: (f) => (can(actor, "masterData", "edit") ? <ActiveToggle id={f.id} active={f.active} action={setFactoryActiveAction} /> : f.active ? "Yes" : "No") },
  ];
  if (can(actor, "masterData", "edit")) {
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
  if (can(actor, "masterData", "delete")) {
    columns.push({ header: "Delete", align: "right", cell: (f) => <RowDeleteButton action={deleteFactoryAction} id={f.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Factories</h1>
      {can(actor, "masterData", "create") && <FactoryForm />}
      <MasterDataTable rows={factories} columns={columns} />
    </div>
  );
}
