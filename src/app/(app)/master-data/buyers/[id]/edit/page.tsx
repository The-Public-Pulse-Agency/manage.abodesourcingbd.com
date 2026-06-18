import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getBuyer } from "@/lib/masterdata/buyer";
import { BuyerEditForm } from "./buyer-edit-form";

export default async function EditBuyerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "masterData", "edit")) redirect("/dashboard");
  const { id } = await params;
  const buyer = await getBuyer(actor, id);
  if (!buyer) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit buyer</h1>
      <BuyerEditForm buyer={{ id: buyer.id, name: buyer.name }} />
    </div>
  );
}
