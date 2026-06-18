import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listPorts } from "@/lib/masterdata/logistics";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { ActiveToggle } from "@/components/master-data/active-toggle";
import { setPortActiveAction } from "@/lib/masterdata/active-form-actions";
import { deletePortAction } from "@/lib/masterdata/delete-form-actions";
import { PortForm } from "./port-form";

type PortRow = Awaited<ReturnType<typeof listPorts>>[number];

export default async function PortsPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "masterData", "view")) redirect("/dashboard");
  const ports = await listPorts(actor, { includeInactive: true });
  const canEdit = can(actor, "masterData", "edit");
  const columns: Column<PortRow>[] = [
    { header: "Name", cell: (p) => p.name },
    { header: "Country", cell: (p) => p.country ?? "" },
    { header: "Active", cell: (p) => (canEdit ? <ActiveToggle id={p.id} active={p.active} action={setPortActiveAction} /> : p.active ? "Yes" : "No") },
  ];
  if (can(actor, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (p) => (
        <Link href={`/master-data/ports/${p.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
    columns.push({ header: "Delete", align: "right", cell: (p) => <RowDeleteButton action={deletePortAction} id={p.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ports</h1>
      {can(actor, "masterData", "create") && <PortForm />}
      <MasterDataTable rows={ports} columns={columns} />
    </div>
  );
}
