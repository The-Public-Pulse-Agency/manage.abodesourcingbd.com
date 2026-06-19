import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listMovements, listPoNumbers, summarise } from "@/lib/sample-ledger/sample-ledger";
import { listStyles } from "@/lib/masterdata/style";
import { listBuyers } from "@/lib/masterdata/buyer";
import { listFactories } from "@/lib/masterdata/factory";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { SampleLedger, type MovementRow, type ArtInfo } from "@/components/reports/sample-ledger";

const dedupeSort = (values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

export default async function SampleLedgerPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "sampling", "view")) redirect("/dashboard");
  const canEdit = can(actor, "sampling", "create");

  const items = await listMovements(actor);
  const { perArt, dashboard } = summarise(items);

  // ---- Autocomplete suggestion sources (tenant-scoped via the list* helpers) ----
  const [styles, buyerList, factoryList, poNumberList] = await Promise.all([
    listStyles(actor),
    listBuyers(actor),
    listFactories(actor),
    listPoNumbers(actor),
  ]);

  const artNos = dedupeSort([...styles.map((s) => s.styleCode), ...items.map((i) => i.artNo)]);
  const buyers = dedupeSort([...buyerList.map((b) => b.name), ...items.map((i) => i.buyer)]);
  const factories = dedupeSort([...factoryList.map((f) => f.name), ...items.map((i) => i.factoryName)]);
  const poNumbers = dedupeSort([...poNumberList, ...items.map((i) => i.poNumber)]);
  const sampleTypes = dedupeSort(items.map((i) => i.sampleType));

  // Auto-fill lookup: most recent matching record per artNo (prefer IN rows).
  // `items` is already sorted newest-first, so the first match wins.
  const artInfo: Record<string, ArtInfo> = {};
  for (const i of items) {
    const key = (i.artNo ?? "").trim();
    if (!key) continue;
    const cur = artInfo[key];
    const info: ArtInfo = {
      buyer: i.buyer?.trim() || undefined,
      sampleType: i.sampleType?.trim() || undefined,
      factory: i.factoryName?.trim() || undefined,
      colour: i.colour?.trim() || undefined,
    };
    if (!cur) {
      artInfo[key] = info;
    } else if (i.direction === "IN" && !cur._fromIn) {
      // Prefer the most recent IN row over any earlier non-IN match.
      artInfo[key] = info;
    }
    if (i.direction === "IN") artInfo[key]._fromIn = true;
  }

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
        <SampleLedger
          inRows={inRows}
          outRows={outRows}
          perArt={perArt}
          canEdit={canEdit}
          artNos={artNos}
          buyers={buyers}
          factories={factories}
          poNumbers={poNumbers}
          sampleTypes={sampleTypes}
          artInfo={artInfo}
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
