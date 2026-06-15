import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBuyers } from "@/lib/masterdata/buyer";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { BuyerForm, BrandForm } from "./buyer-forms";

type BuyerRow = Awaited<ReturnType<typeof listBuyers>>[number];

export default async function BuyersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const buyers = await listBuyers(actor, { includeInactive: true });
  const canCreate = can(actor.role, "masterData", "create");
  const columns: Column<BuyerRow>[] = [
    { header: "Name", cell: (b) => b.name },
    { header: "Code", cell: (b) => b.code },
  ];
  if (can(actor.role, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (b) => (
        <Link href={`/master-data/buyers/${b.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Buyers</h1>
      {canCreate && <BuyerForm />}
      {canCreate && <BrandForm buyers={buyers} />}
      <MasterDataTable rows={buyers} columns={columns} />
    </div>
  );
}
