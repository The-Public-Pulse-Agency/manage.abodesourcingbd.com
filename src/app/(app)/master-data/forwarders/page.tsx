import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listForwarders } from "@/lib/masterdata/logistics";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { ForwarderForm } from "./forwarder-form";

type ForwarderRow = Awaited<ReturnType<typeof listForwarders>>[number];

export default async function ForwardersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const forwarders = await listForwarders(actor, { includeInactive: true });
  const columns: Column<ForwarderRow>[] = [
    { header: "Name", cell: (f) => f.name },
    { header: "Contact", cell: (f) => f.contact ?? "" },
    { header: "Active", cell: (f) => (f.active ? "Yes" : "No") },
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
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Forwarders</h1>
      {can(actor.role, "masterData", "create") && <ForwarderForm />}
      <MasterDataTable rows={forwarders} columns={columns} />
    </div>
  );
}
