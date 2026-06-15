import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listPorts } from "@/lib/masterdata/logistics";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { PortForm } from "./port-form";

type PortRow = Awaited<ReturnType<typeof listPorts>>[number];

export default async function PortsPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const ports = await listPorts(actor, { includeInactive: true });
  const columns: Column<PortRow>[] = [
    { header: "Name", cell: (p) => p.name },
    { header: "Country", cell: (p) => p.country ?? "" },
    { header: "Active", cell: (p) => (p.active ? "Yes" : "No") },
  ];
  if (can(actor.role, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (p) => (
        <Link href={`/master-data/ports/${p.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ports</h1>
      {can(actor.role, "masterData", "create") && <PortForm />}
      <MasterDataTable rows={ports} columns={columns} />
    </div>
  );
}
