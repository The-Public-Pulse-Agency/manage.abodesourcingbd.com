import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listOpenOrders, openOrdersSummary, type OpenOrdersFilter } from "@/lib/reports/open-orders";
import { openOrdersExportAction } from "@/lib/reports/export-actions";
import { listFactories } from "@/lib/masterdata/factory";
import { listBuyers, listBrands } from "@/lib/masterdata/buyer";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { EditableCell } from "@/components/reports/editable-cell";
import { ExportButton } from "@/components/reports/export-button";
import { ReportFilters } from "@/components/reports/report-filters";
import { Pagination } from "@/components/pagination";
import { setOrderShipDate, setOrderRecvDate, setOrderCrd, setOrderRemarks, deleteOrderAction, closeOrderAction } from "@/lib/reports/inline-actions";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { RowCloseButton } from "@/components/reports/row-close-button";
import { ColourCell } from "@/components/reports/colour-cell";
import { ReportPeriodFilter } from "@/components/reports/report-period-filter";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const EXPORT_HEADERS = ["PO", "Status", "PO received", "Factory", "Buyer", "Brand", "Style", "Size", "Colour", "Qty", "Value (USD)", "Confirmed ship", "CRD", "Remarks"];
const STATUS_CLS: Record<string, string> = { DRAFT: "bg-paper text-ink-soft", CONFIRMED: "bg-accent-soft text-accent", IN_PRODUCTION: "bg-warn-soft text-warn", PARTLY_SHIPPED: "bg-ok-soft text-ok" };

type SP = { page?: string; status?: string; factory?: string; buyer?: string; brand?: string; q?: string; shipYear?: string; shipMonth?: string };

export default async function OpenOrdersReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "orders", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const filter: OpenOrdersFilter = {
    status: sp.status,
    factoryIds: sp.factory ? sp.factory.split(",").filter(Boolean) : undefined,
    buyerIds: sp.buyer ? sp.buyer.split(",").filter(Boolean) : undefined,
    brandIds: sp.brand ? sp.brand.split(",").filter(Boolean) : undefined,
    q: sp.q,
    shipYear: sp.shipYear,
    shipMonth: sp.shipMonth,
  };
  // Year options for the ship-period filter: a window around the current year.
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

  // Factory/buyer lists power the filter dropdowns only — gate on masterData:view so a
  // tightly-scoped role (e.g. production-only) can still open this page without a 500.
  const canMaster = can(actor, "masterData", "view");
  // UI must mirror the server guards: only show inline edit / close / delete affordances to
  // users who actually hold the permission (the server enforces these regardless).
  const canEditOrders = can(actor, "orders", "edit");
  const canDeleteOrders = can(actor, "orders", "delete");
  const [book, summary, factories, buyers, brands] = await Promise.all([
    listOpenOrders(actor, filter, { page: Math.max(1, Number(sp.page) || 1) }),
    openOrdersSummary(actor, filter),
    canMaster ? listFactories(actor) : Promise.resolve([]),
    canMaster ? listBuyers(actor) : Promise.resolve([]),
    canMaster ? listBrands(actor) : Promise.resolve([]),
  ]);
  const facMax = Math.max(1, ...summary.byFactory.map((d) => d.value));
  const buyMax = Math.max(1, ...summary.byBuyer.map((d) => d.value));

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Report</p>
          <h1 className="text-2xl font-semibold tracking-tight">Open / Running Orders</h1>
          <p className="mt-1 text-sm text-ink-soft">Live order book — status columns track the critical path in real time.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
          {book.total} matching orders
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Open orders" rail="var(--accent)"><CountUp value={book.total} format="qty" /></Kpi>
        <Kpi label="Total quantity (pcs)" rail="var(--ink)"><CountUp value={summary.totalQty} format="qty" /></Kpi>
        <Kpi label="Order value (USD)" rail="var(--ok)"><CountUp value={summary.totalValue} format="money" /></Kpi>
        <Kpi label="Shipping ≤ 30 days" rail="var(--warn)"><CountUp value={summary.shipping30} format="qty" /></Kpi>
      </div>

      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        <ChartCard title="Quantity by factory"><BarChart data={summary.byFactory} max={facMax} color="var(--accent)" /></ChartCard>
        <ChartCard title="Orders by buyer"><BarChart data={summary.byBuyer} max={buyMax} color="var(--ink)" /></ChartCard>
      </div>

      <div className="rise space-y-3" style={{ animationDelay: "180ms" }}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[15rem] flex-1">
            <ReportFilters
              searchPlaceholder="Search PO, style, colour, factory, buyer…"
              resultLabel={`${book.rows.length} on this page · ${book.total} total`}
              selects={[
                { param: "status", allLabel: "All statuses", options: ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"].map((s) => ({ value: s, label: s.replace("_", " ").toLowerCase() })) },
              ]}
              multiSelects={[
                { param: "factory", allLabel: "All factories", options: factories.map((f) => ({ value: f.id, label: f.name })) },
                { param: "buyer", allLabel: "All buyers", options: buyers.map((b) => ({ value: b.id, label: b.name })) },
                { param: "brand", allLabel: "All brands", options: brands.map((b) => ({ value: b.id, label: b.name })) },
              ]}
            />
          </div>
          <ReportPeriodFilter years={years} />
          <ExportButton filename="open-orders.csv" headers={EXPORT_HEADERS} action={openOrdersExportAction as (a: unknown) => Promise<(string | number)[][]>} actionArg={filter} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
          <table className="list-table w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2.5 font-semibold">PO</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 font-semibold">PO recvd</th>
                <th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Buyer</th><th className="px-3 py-2.5 font-semibold">Brand</th><th className="px-3 py-2.5 font-semibold">Style</th><th className="px-3 py-2.5 font-semibold">Size</th>
                <th className="px-3 py-2.5 font-semibold">Colour</th><th className="px-3 py-2.5 text-right font-semibold">Qty</th><th className="px-3 py-2.5 text-right font-semibold">Value</th><th className="px-3 py-2.5 font-semibold">Conf. ship</th><th className="px-3 py-2.5 font-semibold">CRD</th><th className="px-3 py-2.5 font-semibold">Remarks</th><th className="px-3 py-2.5 font-semibold">PO doc</th><th className="px-3 py-2.5 font-semibold">Edit</th><th className="px-3 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {book.rows.length === 0 && <tr><td colSpan={17} className="px-3 py-10 text-center text-ink-soft">No orders match.</td></tr>}
              {book.rows.flatMap((r) => {
                const sb = r.styleBreakdown;
                const n = sb.length;
                return sb.map((s, i) => (
                  <tr key={`${r.id}-${i}`} className="border-b border-line">
                    {/* PO-level data is repeated on every style row so each line is complete. */}
                    <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="font-mono font-medium text-accent hover:underline">{r.poNumber}</Link></td>
                    <td className="px-3 py-2"><span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${STATUS_CLS[r.status] ?? "bg-paper text-ink-soft"}`}>{r.status.replace("_", " ").toLowerCase()}</span></td>
                    <td className="px-3 py-2 tnum text-xs">{i === 0 && canEditOrders ? <EditableCell id={r.id} raw={iso(r.poReceiveDate)} type="date" action={setOrderRecvDate}>{formatDate(r.poReceiveDate)}</EditableCell> : formatDate(r.poReceiveDate)}</td>
                    <td className="px-3 py-2">{r.factory}</td>
                    <td className="px-3 py-2">{r.buyer}</td>
                    <td className="px-3 py-2">{r.brand}</td>
                    {/* Per-style columns */}
                    <td className="px-3 py-2 font-mono text-xs">{s.style}</td>
                    <td className="px-3 py-2 text-xs">{s.sizes}</td>
                    <td className="px-3 py-2 text-xs"><ColourCell value={s.colours} /></td>
                    <td className="px-3 py-2 text-right tnum">{formatQty(s.qty)}</td>
                    <td className="px-3 py-2 text-right tnum">{s.value > 0 ? formatMoney(s.value, r.currency) : "—"}</td>
                    {/* Dates moved here, after Value */}
                    <td className="px-3 py-2 tnum text-xs">{i === 0 && canEditOrders ? <EditableCell id={r.id} raw={iso(r.confirmedShipDate)} type="date" action={setOrderShipDate}>{formatDate(r.confirmedShipDate)}</EditableCell> : formatDate(r.confirmedShipDate)}</td>
                    <td className="px-3 py-2 tnum text-xs">{i === 0 && canEditOrders ? <EditableCell id={r.id} raw={iso(r.crd)} type="date" action={setOrderCrd}>{formatDate(r.crd)}</EditableCell> : formatDate(r.crd)}</td>
                    <td className="px-3 py-2 text-xs">{i === 0 && canEditOrders ? <EditableCell id={r.id} raw={r.remarks} type="text" action={setOrderRemarks}>{r.remarks || "—"}</EditableCell> : (r.remarks || "—")}</td>
                    {/* Actions: once per PO (these act on the whole order). */}
                    {i === 0 && (
                      <>
                        <td rowSpan={n} className="px-3 py-2 align-top"><a href={`/api/orders/${r.id}/po`} className="text-xs font-medium text-accent hover:underline" title="Download PO (Excel)">PO ⬇</a></td>
                        <td rowSpan={n} className="px-3 py-2 align-top"><Link href={`/orders/${r.id}`} className="text-xs font-medium text-accent hover:underline">Edit →</Link></td>
                        <td rowSpan={n} className="px-3 py-2 align-top">
                          {canEditOrders || canDeleteOrders ? (
                            <span className="inline-flex items-center gap-3">
                              {canEditOrders && r.status === "PARTLY_SHIPPED" && <RowCloseButton action={closeOrderAction} id={r.id} />}
                              {canDeleteOrders && <RowDeleteButton action={deleteOrderAction} id={r.id} />}
                            </span>
                          ) : <span className="text-ink-soft">—</span>}
                        </td>
                      </>
                    )}
                  </tr>
                ));
              })}
            </tbody>
            {book.total > 0 && (
              <tfoot>
                <tr className="border-t-2 border-ink bg-paper font-semibold">
                  <td className="px-3 py-2.5" colSpan={9}>Total — {formatQty(book.total)} order{book.total === 1 ? "" : "s"} (all filtered)</td>
                  <td className="px-3 py-2.5 text-right tnum">{formatQty(summary.totalQty)}</td>
                  <td className="px-3 py-2.5 text-right tnum">{summary.totalValue > 0 ? formatMoney(summary.totalValue, "USD") : "—"}</td>
                  <td className="px-3 py-2.5" colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Pagination page={book.page} totalPages={book.totalPages} total={book.total} pageSize={book.pageSize} params={sp} />
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
      <div className="border-b border-line bg-paper px-4 py-2.5"><h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3></div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BarChart({ data, max, color }: { data: { label: string; value: number }[]; max: number; color: string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">No data.</p>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-ink-soft" title={d.label}>{d.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-paper"><div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: color }} /></div>
          <span className="tnum text-right text-xs font-semibold">{formatQty(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
