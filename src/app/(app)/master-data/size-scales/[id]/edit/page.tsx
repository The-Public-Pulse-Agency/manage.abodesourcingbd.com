import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getSizeScale } from "@/lib/masterdata/sizescale";
import { SizeScaleEditForm } from "./size-scale-edit-form";

export default async function EditSizeScalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const scale = await getSizeScale(actor, id);
  if (!scale) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit size scale</h1>
      <SizeScaleEditForm
        id={scale.id}
        name={scale.name}
        sizes={scale.sizes.map((s) => s.label).join(", ")}
      />
    </div>
  );
}
