import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getStyle } from "@/lib/masterdata/style";
import { listBrands } from "@/lib/masterdata/buyer";
import { StyleEditForm } from "./style-edit-form";

export default async function EditStylePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const style = await getStyle(actor, id);
  if (!style) notFound();
  const brands = await listBrands(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit style</h1>
      <StyleEditForm
        style={{
          id: style.id,
          brandId: style.brandId,
          styleCode: style.styleCode,
          name: style.name,
          category: style.category,
          composition: style.composition,
          description: style.description,
        }}
        brands={brands}
      />
    </div>
  );
}
