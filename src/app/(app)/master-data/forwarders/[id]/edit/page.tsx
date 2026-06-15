import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getForwarder } from "@/lib/masterdata/logistics";
import { ForwarderEditForm } from "./forwarder-edit-form";

export default async function EditForwarderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "edit")) redirect("/dashboard");
  const forwarder = await getForwarder(actor, id);
  if (!forwarder) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit forwarder</h1>
      <ForwarderEditForm id={forwarder.id} name={forwarder.name} contact={forwarder.contact ?? ""} />
    </div>
  );
}
