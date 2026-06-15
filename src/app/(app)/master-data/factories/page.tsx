import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactories } from "@/lib/masterdata/factory";
import { MasterDataTable } from "@/components/master-data-table";
import { FactoryForm } from "./factory-form";

export default async function FactoriesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const factories = await listFactories(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Factories</h1>
      {can(actor.role, "masterData", "create") && <FactoryForm />}
      <MasterDataTable
        rows={factories}
        columns={[
          { header: "Name", cell: (f) => f.name },
          { header: "Code", cell: (f) => f.code },
          { header: "Type", cell: (f) => f.type },
          { header: "Active", cell: (f) => (f.active ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
