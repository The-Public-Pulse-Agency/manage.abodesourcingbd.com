import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listForwarders } from "@/lib/masterdata/logistics";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { ActiveToggle } from "@/components/master-data/active-toggle";
import { setForwarderActiveAction } from "@/lib/masterdata/active-form-actions";
import { deleteForwarderAction } from "@/lib/masterdata/delete-form-actions";
import { ForwarderForm } from "./forwarder-form";

type ForwarderRow = Awaited<ReturnType<typeof listForwarders>>[number];

export default async function ForwardersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const forwarders = await listForwarders(actor, { includeInactive: true });
  const canEdit = can(actor.role, "masterData", "edit");
  const columns: Column<ForwarderRow>[] = [
    { header: "Name", cell: (f) => f.name },
    { header: "Contact", cell: (f) => f.contact ?? "" },
    { header: "Active", cell: (f) => (canEdit ? <ActiveToggle id={f.id} active={f.active} action={setForwarderActiveAction} /> : f.active ? "Yes" : "No") },
  ];
  if (can(actor.role, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (f) => (
        <Link href={`/master-data/forwarders/${f.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
    columns.push({ header: "Delete", align: "right", cell: (f) => <RowDeleteButton action={deleteForwarderAction} id={f.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Forwarders</h1>
      {can(actor.role, "masterData", "create") && <ForwarderForm />}
      <MasterDataTable rows={forwarders} columns={columns} />
    </div>
  );
}
