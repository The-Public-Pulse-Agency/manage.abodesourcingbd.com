import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listStyles } from "@/lib/masterdata/style";
import { MasterDataTable } from "@/components/master-data-table";

export default async function StylesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const styles = await listStyles(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Styles</h1>
      <MasterDataTable
        rows={styles}
        columns={[
          { header: "Code", cell: (s) => s.styleCode },
          { header: "Name", cell: (s) => s.name },
        ]}
      />
    </div>
  );
}
