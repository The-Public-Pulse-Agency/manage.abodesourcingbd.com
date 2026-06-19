import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBuyerSamples } from "@/lib/buyer-samples/buyer-samples";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { BuyerSampleTable, type BuyerSampleRow } from "@/components/reports/buyer-sample-table";

export default async function BuyerSamplesReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "sampling", "view")) redirect("/dashboard");
  const canEdit = can(actor, "sampling", "create");

  const items = await listBuyerSamples(actor);

  const rows: BuyerSampleRow[] = items.map((i) => ({
    id: i.id,
    buyerName: i.buyerName ?? "",
    sampleType: i.sampleType ?? "",
    artNo: i.artNo ?? "",
    styleName: i.styleName ?? "",
    factoryName: i.factoryName ?? "",
    courierName: i.courierName ?? "",
    awbNumber: i.awbNumber ?? "",
    sendDateRaw: i.sendDate ? new Date(i.sendDate).toISOString().slice(0, 10) : "",
    sendDateDisplay: i.sendDate ? formatDate(i.sendDate) : "—",
    numSamples: i.numSamples != null ? String(i.numSamples) : "",
    approxArrivalRaw: i.approxArrival ? new Date(i.approxArrival).toISOString().slice(0, 10) : "",
    approxArrivalDisplay: i.approxArrival ? formatDate(i.approxArrival) : "—",
    notes: i.notes ?? "",
  }));
  const totalPcs = items.reduce((sum, i) => sum + (i.numSamples ?? 0), 0);
  const buyers = new Set(items.map((i) => (i.buyerName ?? "").trim()).filter(Boolean)).size;
  const couriered = items.filter((i) => (i.awbNumber ?? "").trim()).length;

  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="eyebrow">Sampling</p>
        <h1 className="text-2xl font-semibold tracking-tight">Buyer Sample Tracking</h1>
        <p className="mt-1 text-sm text-ink-soft">Outbound buyer sample dispatch tracker — couriered samples, AWB numbers &amp; expected arrival.</p>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Buyer samples" rail="var(--accent)"><CountUp value={rows.length} format="qty" /></Kpi>
        <Kpi label="Total pcs sent" rail="var(--ok)"><CountUp value={totalPcs} format="qty" /></Kpi>
        <Kpi label="Buyers" rail="var(--ink)"><CountUp value={buyers} format="qty" /></Kpi>
        <Kpi label="Couriered" rail="var(--warn)"><CountUp value={couriered} format="qty" /></Kpi>
      </div>

      <div className="rise" style={{ animationDelay: "120ms" }}>
        <BuyerSampleTable rows={rows} canEdit={canEdit} />
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
