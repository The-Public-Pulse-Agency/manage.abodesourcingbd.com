import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listStyles } from "@/lib/masterdata/style";
import { listBrands } from "@/lib/masterdata/buyer";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { deleteStyleAction } from "@/lib/masterdata/delete-form-actions";
import { StyleForm } from "./style-form";

export default async function StylesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const styles = await listStyles(actor, { includeInactive: true });
  const canCreate = can(actor.role, "masterData", "create");
  const canEdit = can(actor.role, "masterData", "edit");
  const brands = canCreate ? await listBrands(actor) : [];
  type StyleRow = (typeof styles)[number];
  const columns: Column<StyleRow>[] = [
    { header: "Code", cell: (s) => s.styleCode },
    { header: "Name", cell: (s) => s.name },
  ];
  if (canEdit) {
    columns.push({
      header: "",
      align: "right",
      cell: (s) => (
        <Link href={`/master-data/styles/${s.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
  }
  if (can(actor.role, "masterData", "delete")) {
    columns.push({ header: "Delete", align: "right", cell: (s) => <RowDeleteButton action={deleteStyleAction} id={s.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Styles</h1>
      {canCreate && <StyleForm brands={brands} />}
      <MasterDataTable rows={styles} columns={columns} />
    </div>
  );
}
