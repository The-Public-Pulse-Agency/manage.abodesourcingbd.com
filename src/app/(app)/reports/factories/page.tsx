import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactoriesWithCertificates } from "@/lib/masterdata/certificates";
import { FactoryCertificates, type CertRow } from "@/components/factory-certificates";
import { formatDate } from "@/lib/format";

function validity(d: Date | null): CertRow["validityState"] {
  if (!d) return "na";
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 60) return "expiring";
  return "ok";
}

export default async function FactoryInfoPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const canEdit = can(actor.role, "masterData", "edit");
  const factories = await listFactoriesWithCertificates(actor);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Report</p>
        <h1 className="text-2xl font-semibold tracking-tight">Factory Information</h1>
        <p className="mt-1 text-sm text-ink-soft">{factories.length} factories · compliance certificates &amp; validity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {factories.map((f) => (
          <div key={f.id} className="overflow-hidden rounded-md border border-line bg-surface elevate">
            <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
              <div>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="font-mono text-xs text-ink-soft">{f.code} · {f.type}</p>
              </div>
              <span className="text-xs text-ink-soft">{f.certificates.length} cert{f.certificates.length === 1 ? "" : "s"}</span>
            </div>
            <FactoryCertificates
              factoryId={f.id}
              canEdit={canEdit}
              certs={f.certificates.map((c) => ({
                id: c.id,
                name: c.name,
                number: c.number,
                validUntil: c.validUntil ? formatDate(c.validUntil) : null,
                validityState: validity(c.validUntil),
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
