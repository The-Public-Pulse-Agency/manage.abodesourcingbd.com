import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getPort } from "@/lib/masterdata/logistics";
import { PortEditForm } from "./port-edit-form";

export default async function EditPortPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const port = await getPort(actor, id);
  if (!port) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit port</h1>
      <PortEditForm id={port.id} name={port.name} country={port.country ?? ""} />
    </div>
  );
}
