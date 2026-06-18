import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listDevelopment } from "@/lib/development/development";
import { listFactories } from "@/lib/masterdata/factory";
import { listBuyers } from "@/lib/masterdata/buyer";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { DevelopmentTable, type DevRow } from "@/components/reports/development-table";

export default async function DevelopmentReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "orders", "view")) redirect("/dashboard");
  const canEdit = can(actor, "orders", "create");

  const [items, factories, buyers] = await Promise.all([listDevelopment(actor), listFactories(actor), listBuyers(actor)]);
  const facName = new Map(factories.map((f) => [f.id, f.name]));
  const buyName = new Map(buyers.map((b) => [b.id, b.name]));

  const rows: DevRow[] = items.map((i) => ({
    id: i.id,
    factory: i.factoryId ? facName.get(i.factoryId) ?? "—" : "—",
    buyer: i.buyerId ? buyName.get(i.buyerId) ?? "—" : "—",
    factoryId: i.factoryId ?? "",
    buyerId: i.buyerId ?? "",
    styleRef: i.styleRef,
    colour: i.colour ?? "",
    labDip: i.labDip ?? "",
    knitting: i.knitting ?? "",
    firstSample: i.firstSample ?? "",
    secondSample: i.secondSample ?? "",
    finalSampleRaw: i.finalSampleDate ? new Date(i.finalSampleDate).toISOString().slice(0, 10) : "",
    finalSampleDisplay: i.finalSampleDate ? formatDate(i.finalSampleDate) : "—",
    confirmedPrice: i.confirmedPrice ?? "",
    remarks: i.remarks ?? "",
  }));
  const sampled = rows.filter((r) => r.finalSampleRaw).length;

  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="eyebrow">Development</p>
        <h1 className="text-2xl font-semibold tracking-tight">Development Program</h1>
        <p className="mt-1 text-sm text-ink-soft">Sample development tracker — lab dip, knitting &amp; sample approvals. Separate from production orders.</p>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Development items" rail="var(--accent)"><CountUp value={rows.length} format="qty" /></Kpi>
        <Kpi label="Final sample sent" rail="var(--ok)"><CountUp value={sampled} format="qty" /></Kpi>
        <Kpi label="Factories" rail="var(--ink)"><CountUp value={new Set(items.map((i) => i.factoryId).filter(Boolean)).size} format="qty" /></Kpi>
        <Kpi label="Buyers" rail="var(--warn)"><CountUp value={new Set(items.map((i) => i.buyerId).filter(Boolean)).size} format="qty" /></Kpi>
      </div>

      <div className="rise" style={{ animationDelay: "120ms" }}>
        <DevelopmentTable
          rows={rows}
          canEdit={canEdit}
          factories={factories.map((f) => ({ value: f.id, label: f.name }))}
          buyers={buyers.map((b) => ({ value: b.id, label: b.name }))}
        />
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
