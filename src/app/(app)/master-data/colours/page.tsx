import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listColours } from "@/lib/masterdata/sizescale";
import { MasterDataTable } from "@/components/master-data-table";
import { ColourForm } from "./colour-form";

export default async function ColoursPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const colours = await listColours(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Colours</h1>
      {can(actor.role, "masterData", "create") && <ColourForm />}
      <MasterDataTable
        rows={colours}
        columns={[
          { header: "Name", cell: (c) => c.name },
          { header: "Code", cell: (c) => c.code ?? "" },
        ]}
      />
    </div>
  );
}
