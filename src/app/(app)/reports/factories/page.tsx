import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactoriesWithCertificates } from "@/lib/masterdata/certificates";
import { FactoryCertificates, type CertRow } from "@/components/factory-certificates";
import { CountUp } from "@/components/dashboard/count-up";
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

  const allCerts = factories.flatMap((f) => f.certificates);
  const expiring = allCerts.filter((c) => validity(c.validUntil) === "expiring").length;
  const expired = allCerts.filter((c) => validity(c.validUntil) === "expired").length;

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Report</p>
          <h1 className="text-2xl font-semibold tracking-tight">Factory Information</h1>
          <p className="mt-1 text-sm text-ink-soft">Compliance certificates &amp; validity across your factory base.</p>
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Factories" rail="var(--accent)"><CountUp value={factories.length} format="qty" /></Kpi>
        <Kpi label="Certificates" rail="var(--ink)"><CountUp value={allCerts.length} format="qty" /></Kpi>
        <Kpi label="Expiring ≤ 60 days" rail="var(--warn)"><CountUp value={expiring} format="qty" /></Kpi>
        <Kpi label="Expired" rail="var(--bad)"><CountUp value={expired} format="qty" /></Kpi>
      </div>

      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        {factories.map((f) => (
          <div key={f.id} className="overflow-hidden rounded-lg border border-line bg-surface elevate">
            <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
              <div>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="font-mono text-xs text-ink-soft">{f.code} · {f.type}</p>
              </div>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-soft">{f.certificates.length} cert{f.certificates.length === 1 ? "" : "s"}</span>
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

function Kpi({ label, rail, children }: { label: string; rail: string; children: React.ReactNode }) {
  return (
    <div className="kpi rounded-lg border border-line bg-surface p-4 elevate" style={{ "--kpi-rail": rail } as React.CSSProperties}>
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold">{children}</p>
    </div>
  );
}
