import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listColours } from "@/lib/masterdata/sizescale";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { deleteColourAction } from "@/lib/masterdata/delete-form-actions";
import { ColourForm } from "./colour-form";

type ColourRow = Awaited<ReturnType<typeof listColours>>[number];

export default async function ColoursPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "masterData", "view")) redirect("/dashboard");
  const colours = await listColours(actor);
  const canEdit = can(actor, "masterData", "edit");
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
  if (can(actor, "masterData", "delete")) {
    columns.push({ header: "Delete", align: "right", cell: (c) => <RowDeleteButton action={deleteColourAction} id={c.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Colours</h1>
      {can(actor, "masterData", "create") && <ColourForm />}
      <MasterDataTable rows={colours} columns={columns} />
    </div>
  );
}
