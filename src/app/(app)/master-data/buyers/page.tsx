import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBuyers } from "@/lib/masterdata/buyer";
import { MasterDataTable } from "@/components/master-data-table";

export default async function BuyersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const buyers = await listBuyers(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Buyers</h1>
      <MasterDataTable
        rows={buyers}
        columns={[
          { header: "Name", cell: (b) => b.name },
          { header: "Code", cell: (b) => b.code },
        ]}
      />
    </div>
  );
}
