import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listColours } from "@/lib/masterdata/sizescale";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { ColourForm } from "./colour-form";

type ColourRow = Awaited<ReturnType<typeof listColours>>[number];

export default async function ColoursPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const colours = await listColours(actor);
  const canEdit = can(actor.role, "masterData", "edit");
  const columns: Column<ColourRow>[] = [
    { header: "Name", cell: (c) => c.name },
    { header: "Code", cell: (c) => c.code ?? "" },
  ];
  if (canEdit) {
    columns.push({
      header: "",
      align: "right",
      cell: (c) => (
        <Link
          href={`/master-data/colours/${c.id}/edit`}
          className="text-accent hover:underline"
        >
          Edit
        </Link>
      ),
    });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Colours</h1>
      {can(actor.role, "masterData", "create") && <ColourForm />}
      <MasterDataTable rows={colours} columns={columns} />
    </div>
  );
}
