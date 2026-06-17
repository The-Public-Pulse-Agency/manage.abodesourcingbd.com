import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listSizeScales } from "@/lib/masterdata/sizescale";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { deleteSizeScaleAction } from "@/lib/masterdata/delete-form-actions";
import { SizeScaleForm } from "./size-scale-form";

type SizeScaleRow = Awaited<ReturnType<typeof listSizeScales>>[number];

export default async function SizeScalesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const scales = await listSizeScales(actor);
  const canEdit = can(actor.role, "masterData", "edit");
  const columns: Column<SizeScaleRow>[] = [
    { header: "Name", cell: (s) => s.name },
    { header: "Sizes", cell: (s) => s.sizes.map((z) => z.label).join(", ") },
  ];
  if (canEdit) {
    columns.push({
      header: "",
      align: "right",
      cell: (s) => (
        <Link
          href={`/master-data/size-scales/${s.id}/edit`}
          className="text-accent hover:underline"
        >
          Edit
        </Link>
      ),
    });
    columns.push({ header: "Delete", align: "right", cell: (s) => <RowDeleteButton action={deleteSizeScaleAction} id={s.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Size scales</h1>
      {can(actor.role, "masterData", "create") && <SizeScaleForm />}
      <MasterDataTable rows={scales} columns={columns} />
    </div>
  );
}
