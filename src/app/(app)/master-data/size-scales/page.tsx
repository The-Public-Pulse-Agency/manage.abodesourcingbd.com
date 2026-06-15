import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listSizeScales } from "@/lib/masterdata/sizescale";
import { MasterDataTable } from "@/components/master-data-table";

export default async function SizeScalesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const scales = await listSizeScales(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Size scales</h1>
      <MasterDataTable
        rows={scales}
        columns={[
          { header: "Name", cell: (s) => s.name },
          { header: "Sizes", cell: (s) => s.sizes.map((z) => z.label).join(", ") },
        ]}
      />
    </div>
  );
}
