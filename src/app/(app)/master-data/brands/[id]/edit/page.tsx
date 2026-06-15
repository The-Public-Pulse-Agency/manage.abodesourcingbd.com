import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getBrand, listBuyers } from "@/lib/masterdata/buyer";
import { BrandEditForm } from "./brand-edit-form";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const { id } = await params;
  const brand = await getBrand(actor, id);
  if (!brand) notFound();
  const buyers = await listBuyers(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit brand</h1>
      <BrandEditForm
        brand={{
          id: brand.id,
          buyerId: brand.buyerId,
          name: brand.name,
          code: brand.code,
        }}
        buyers={buyers.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
