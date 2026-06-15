import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "create")) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Import master data</h1>
      <p className="text-slate-600">
        Upload the BD open orders .xlsx. Factories, buyers, brands and styles will be
        extracted, de-duplicated and added. Re-running is safe (idempotent).
      </p>
      <ImportForm />
    </div>
  );
}
