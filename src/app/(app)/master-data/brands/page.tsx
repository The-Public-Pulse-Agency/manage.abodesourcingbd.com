import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBrands, listBuyers } from "@/lib/masterdata/buyer";
import { MasterDataTable, type Column } from "@/components/master-data-table";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { deleteBrandAction } from "@/lib/masterdata/delete-form-actions";
import { BrandForm } from "../buyers/buyer-forms";

type BrandRow = Awaited<ReturnType<typeof listBrands>>[number];

export default async function BrandsPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const [brands, buyers] = await Promise.all([
    listBrands(actor),
    listBuyers(actor, { includeInactive: true }),
  ]);
  const buyerNameById = new Map(buyers.map((b) => [b.id, b.name]));
  const columns: Column<BrandRow>[] = [
    { header: "Brand name", cell: (b) => b.name },
    { header: "Code", cell: (b) => b.code },
    { header: "Buyer", cell: (b) => buyerNameById.get(b.buyerId) ?? "—" },
  ];
  if (can(actor.role, "masterData", "edit")) {
    columns.push({
      header: "Edit",
      align: "right",
      cell: (b) => (
        <Link href={`/master-data/brands/${b.id}/edit`} className="text-accent hover:underline">
          Edit
        </Link>
      ),
    });
  }
  if (can(actor.role, "masterData", "delete")) {
    columns.push({ header: "Delete", align: "right", cell: (b) => <RowDeleteButton action={deleteBrandAction} id={b.id} /> });
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Brands</h1>
      {can(actor.role, "masterData", "create") && <BrandForm buyers={buyers} />}
      <MasterDataTable rows={brands} columns={columns} />
    </div>
  );
}
