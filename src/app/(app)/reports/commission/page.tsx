import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listCommission } from "@/lib/commission/commission";
import { listFactories } from "@/lib/masterdata/factory";
import { listBuyers } from "@/lib/masterdata/buyer";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { CommissionTable, type CommRow } from "@/components/reports/commission-table";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function CommissionReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "finance", "view")) redirect("/dashboard");
  const canEdit = can(actor.role, "finance", "edit");

  const [items, factories, buyers] = await Promise.all([listCommission(actor), listFactories(actor), listBuyers(actor)]);
  const facName = new Map(factories.map((f) => [f.id, f.name]));
  const buyName = new Map(buyers.map((b) => [b.id, b.name]));

  const rows: CommRow[] = items.map((i) => {
    const fv = i.factoryInvoiceValue != null ? Number(i.factoryInvoiceValue) : null;
    const pct = i.commissionPct != null ? Number(i.commissionPct) : null;
    const commAmt = fv != null && pct != null ? Math.round(fv * pct) / 100 : null;
    return {
      id: i.id,
      factory: i.factoryId ? facName.get(i.factoryId) ?? "—" : "—",
      buyer: i.buyerId ? buyName.get(i.buyerId) ?? "—" : "—",
      factoryId: i.factoryId ?? "",
      buyerId: i.buyerId ?? "",
      factoryInvoiceNo: i.factoryInvoiceNo ?? "",
      factoryInvoiceValue: fv,
      factoryInvoiceValueRaw: fv != null ? String(fv) : "",
      commissionPct: pct,
      commissionPctRaw: pct != null ? String(pct) : "",
      commissionAmount: commAmt,
      ownInvoiceNo: i.ownInvoiceNo ?? "",
      issueRaw: iso(i.issueDate),
      issueDisplay: i.issueDate ? formatDate(i.issueDate) : "—",
      dueRaw: iso(i.dueDate),
      dueDisplay: i.dueDate ? formatDate(i.dueDate) : "—",
      paymentStatus: i.paymentStatus ?? "",
      remarks: i.remarks ?? "",
    };
  });
  const totalComm = rows.reduce((a, r) => a + (r.commissionAmount ?? 0), 0);
  const awaiting = rows.filter((r) => r.paymentStatus && r.paymentStatus !== "Paid").length;

  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="eyebrow">Finance</p>
        <h1 className="text-2xl font-semibold tracking-tight">Buyer Commission</h1>
        <p className="mt-1 text-sm text-ink-soft">Commission ledger — factory invoice vs own invoice, commission % &amp; payment status.</p>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Entries" rail="var(--accent)"><CountUp value={rows.length} format="qty" /></Kpi>
        <Kpi label="Total commission" rail="var(--ok)"><CountUp value={Math.round(totalComm)} format="money" /></Kpi>
        <Kpi label="Awaiting payment" rail="var(--warn)"><CountUp value={awaiting} format="qty" /></Kpi>
        <Kpi label="Buyers" rail="var(--ink)"><CountUp value={new Set(items.map((i) => i.buyerId).filter(Boolean)).size} format="qty" /></Kpi>
      </div>

      <div className="rise" style={{ animationDelay: "120ms" }}>
        <CommissionTable
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
