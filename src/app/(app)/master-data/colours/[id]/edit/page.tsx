import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getColour } from "@/lib/masterdata/sizescale";
import { ColourEditForm } from "./colour-edit-form";

export default async function EditColourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const colour = await getColour(actor, id);
  if (!colour) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit colour</h1>
      <ColourEditForm id={colour.id} name={colour.name} code={colour.code ?? ""} />
    </div>
  );
}
