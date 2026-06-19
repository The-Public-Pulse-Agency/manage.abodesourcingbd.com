import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listMovements, summarise } from "@/lib/sample-ledger/sample-ledger";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { SampleLedger, type MovementRow } from "@/components/reports/sample-ledger";

export default async function SampleLedgerPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "sampling", "view")) redirect("/dashboard");
  const canEdit = can(actor, "sampling", "create");

  const items = await listMovements(actor);
  const { perArt, dashboard } = summarise(items);

  const toRow = (i: (typeof items)[number]): MovementRow => ({
    id: i.id,
    direction: i.direction,
    dateRaw: i.movementDate ? new Date(i.movementDate).toISOString().slice(0, 10) : "",
    dateDisplay: i.movementDate ? formatDate(i.movementDate) : "—",
    sampleType: i.sampleType ?? "",
    qty: i.qty != null ? String(i.qty) : "",
    artNo: i.artNo ?? "",
    buyer: i.buyer ?? "",
    poNumber: i.poNumber ?? "",
    factoryName: i.factoryName ?? "",
    colour: i.colour ?? "",
    receivedFrom: i.receivedFrom ?? "",
    sentTo: i.sentTo ?? "",
    courierName: i.courierName ?? "",
    awbNumber: i.awbNumber ?? "",
    remarks: i.remarks ?? "",
  });

  const inRows = items.filter((i) => i.direction === "IN").map(toRow);
  const outRows = items.filter((i) => i.direction === "OUT").map(toRow);

  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="eyebrow">Sampling</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dhaka Office Sample In/Out</h1>
        <p className="mt-1 text-sm text-ink-soft">Track samples received into and dispatched from the Dhaka office, with auto-synced balances per art/style.</p>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Total received" rail="var(--ok)"><CountUp value={dashboard.totalReceived} format="qty" /></Kpi>
        <Kpi label="Total sent" rail="var(--accent)"><CountUp value={dashboard.totalSent} format="qty" /></Kpi>
        <Kpi label="Currently in office" rail="var(--ink)"><CountUp value={dashboard.currentInOffice} format="qty" /></Kpi>
        <Kpi label="Pending dispatch" rail="var(--warn)"><CountUp value={dashboard.pendingDispatch} format="qty" /></Kpi>
      </div>

      {(dashboard.byBuyer.length > 0 || dashboard.byFactory.length > 0) && (
        <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "90ms" }}>
          <BreakdownList title="Received by buyer" items={dashboard.byBuyer} />
          <BreakdownList title="Received by factory" items={dashboard.byFactory} />
        </div>
      )}

      <div className="rise" style={{ animationDelay: "120ms" }}>
        <SampleLedger inRows={inRows} outRows={outRows} perArt={perArt} canEdit={canEdit} />
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

function BreakdownList({ title, items }: { title: string; items: Array<{ name: string; qty: number }> }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-surface p-4 elevate">
      <p className="eyebrow">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 8).map((it) => (
          <li key={it.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-ink-soft">{it.name}</span>
            <span className="tnum font-medium">{it.qty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
