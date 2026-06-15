import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getFactory } from "@/lib/masterdata/factory";
import { FactoryEditForm } from "./factory-edit-form";

export default async function EditFactoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const { id } = await params;
  const factory = await getFactory(actor, id);
  if (!factory) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit factory</h1>
      <FactoryEditForm
        factory={{
          id: factory.id,
          name: factory.name,
          type: factory.type,
          contactName: factory.contactName,
        }}
      />
    </div>
  );
}
