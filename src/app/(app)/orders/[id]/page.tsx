import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, tenantId } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getPurchaseOrder } from "@/lib/orders/po";
import { lineTotals, marginPct } from "@/lib/orders/money";
import { listCostItems } from "@/lib/orders/cost-items";
import { listMaterials } from "@/lib/materials/materials";
import { getSubscription } from "@/lib/billing/subscription";
import { CostingPanel } from "@/components/costing-panel";
import { MaterialsPanel } from "@/components/materials-panel";
import { listStyles } from "@/lib/masterdata/style";
import { listColours, listSizeScales } from "@/lib/masterdata/sizescale";
import { listPoMilestones } from "@/lib/tna/milestones";
import { listSampleRequests } from "@/lib/sampling/sampling";
import { getProduction } from "@/lib/production/production";
import { listInspections } from "@/lib/qc/qc";
import { getPoBalance } from "@/lib/shipment/balance-db";
import { listDocuments } from "@/lib/documents/documents";
import { listInvoices } from "@/lib/finance/invoices";
import { outstanding } from "@/lib/finance/money";
import { StatusPill } from "@/components/status-pill";
import { DocumentsPanel } from "@/components/documents-panel";
import { InvoicesPanel, type InvoiceRow } from "@/components/invoices-panel";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { SizeGridForm } from "./size-grid-form";
import { ConfirmButton, ApproveCostingButton, CloseButton, RemoveLineButton, LotWidget } from "./order-detail-actions";
import { TnaTimeline } from "./tna-timeline";
import { SamplingPanel } from "./sampling-panel";
import { ProductionPanel } from "./production-panel";
import { QcPanel } from "./qc-panel";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const { id } = await params;
  const po = await getPurchaseOrder(actor, id);
  if (!po) notFound();

  const role = actor.role;
  const isDraft = po.status === "DRAFT";
  const isActive = po.status !== "CANCELLED" && po.status !== "CLOSED";
  const canEdit = can(role, "orders", "edit") && isDraft;
  const canDelete = can(role, "orders", "delete") && isDraft;

  const canTna = can(role, "criticalPath", "view");
  const canSampling = can(role, "sampling", "view");
  const canPqc = can(role, "productionQc", "view");
  const canShip = can(role, "shipment", "view");
  const canDocs = can(role, "documents", "view");
  const canFinance = can(role, "finance", "view");
  const canCosting = can(role, "costing", "view");

  // Every read below is independent — run them concurrently so the page waits on the
  // single slowest query, not the sum of all of them.
  const [colours, styles, sizeScales, milestones, samples, production, inspections, balance, documents, invoices, costItems, materials, sub] =
    await Promise.all([
      listColours(actor),
      canEdit ? listStyles(actor, { brandId: po.brandId }) : Promise.resolve([]),
      canEdit ? listSizeScales(actor) : Promise.resolve([]),
      canTna ? listPoMilestones(actor, po.id, new Date()) : Promise.resolve([]),
      canSampling ? listSampleRequests(actor, po.id) : Promise.resolve([]),
      canPqc ? getProduction(actor, po.id) : Promise.resolve(null),
      canPqc ? listInspections(actor, po.id) : Promise.resolve([]),
      canShip && !isDraft ? getPoBalance(actor, po.id) : Promise.resolve([]),
      canDocs ? listDocuments(actor, "PurchaseOrder", po.id) : Promise.resolve([]),
      canFinance ? listInvoices(actor, { poId: po.id }) : Promise.resolve([]),
      canCosting ? listCostItems(actor, po.id) : Promise.resolve([]),
      canPqc && !isDraft ? listMaterials(actor, po.id) : Promise.resolve([]),
      getSubscription(tenantId(actor)),
    ]);

  const hasBalance = balance.some((l) => l.sizes.some((s) => s.balance > 0));
  const isoDay = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    type: inv.type,
    number: inv.number,
    amount: Number(inv.amount),
    outstanding: inv.status === "PAID" ? 0 : outstanding(inv.amount, inv.payments),
    status: inv.status,
    currency: inv.currency,
    poId: inv.poId,
    issueDate: isoDay(inv.issueDate),
    dueDate: isoDay(inv.dueDate),
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paidDate: isoDay(p.date) ?? "",
    })),
  }));
  const canCloseStatus = po.status === "SHIPPED" || po.status === "PARTLY_SHIPPED";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-sm text-ink-soft hover:text-accent">
          ← Open Order Book
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{po.poNumber}</h1>
          <StatusPill status={po.status} />
          <span className="font-mono text-xs text-ink-soft">{po.channel}</span>
          <a href={`/api/orders/${po.id}/po`} className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-accent hover:text-accent" title="Download PO (Excel)">PO ⬇</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <dl className="lg:col-span-2 grid grid-cols-2 gap-x-6 gap-y-3 rounded-sm border border-line bg-surface p-5 sm:grid-cols-3">
          <Meta label="Buyer" value={po.buyer.name} />
          <Meta label="Brand" value={po.brand.name} />
          <Meta label="Factory" value={po.factory.name} />
          <Meta label="Order date" value={formatDate(po.orderDate)} />
          <Meta label="CRD" value={formatDate(po.crd)} />
          <Meta label="Ex-factory" value={formatDate(po.exFactoryDate)} />
          <Meta label="Currency" value={po.currency} />
          <Meta label="Lot" value={po.lot?.name ?? "—"} />
        </dl>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line">
          <Stat label="Total qty" value={formatQty(po.totals.qty)} />
          <Stat label="Value" value={formatMoney(po.totals.value, po.currency)} />
          <Stat label="Cost" value={formatMoney(po.totals.cost, po.currency)} />
          <Stat label="Margin" value={`${formatMoney(po.totals.margin, po.currency)} · ${marginPct(po.totals) ?? "—"}%`} accent />
        </div>
      </div>

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Style</th>
              <th className="px-3 py-2 font-semibold">Colour</th>
              <th className="px-3 py-2 font-semibold">Sizes</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Value</th>
              <th className="px-3 py-2 text-right font-semibold">Margin</th>
              {canDelete && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {po.lines.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 7 : 6} className="px-3 py-8 text-center text-ink-soft">
                  No lines yet{canEdit ? " — add one below." : "."}
                </td>
              </tr>
            )}
            {po.lines.map((line) => {
              const t = lineTotals(line.sizes);
              return (
                <tr key={line.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs font-medium">{line.style.styleCode}</span>
                    <div className="text-xs text-ink-soft">{line.style.name}</div>
                  </td>
                  <td className="px-3 py-2">{line.colour?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {line.sizes.map((s) => (
                        <span key={s.id} className="tnum rounded-sm bg-paper px-1.5 py-0.5 text-xs">
                          {s.label}·{s.qty}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tnum">{formatQty(t.qty)}</td>
                  <td className="px-3 py-2 text-right tnum">{formatMoney(t.value, po.currency)}</td>
                  <td className="px-3 py-2 text-right tnum">{formatMoney(t.margin, po.currency)}</td>
                  {canDelete && (
                    <td className="px-3 py-2 text-right">
                      <RemoveLineButton poId={po.id} lineId={line.id} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canCosting && (
        <CostingPanel
          poId={po.id}
          items={costItems.map((c) => ({ id: c.id, category: c.category, label: c.label, amountPerUnit: Number(c.amountPerUnit), note: c.note }))}
          netPerUnit={po.totals.qty > 0 ? po.totals.cost / po.totals.qty : 0}
          sellPerUnit={po.totals.qty > 0 ? po.totals.value / po.totals.qty : 0}
          marginPct={marginPct(po.totals)}
          minMarginPct={sub.minMarginPct}
          canEdit={can(role, "costing", "edit") && isDraft}
        />
      )}

      {canEdit ? (
        <>
          <SizeGridForm
            poId={po.id}
            styles={styles.map((s) => ({ id: s.id, name: `${s.styleCode} — ${s.name}` }))}
            colours={colours.map((c) => ({ id: c.id, name: c.name }))}
            sizeScales={sizeScales.map((s) => ({
              id: s.id,
              name: s.name,
              sizes: s.sizes.map((z) => ({ label: z.label })),
            }))}
          />
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-sm border border-line bg-surface p-5">
            <div className="space-y-1">
              <p className="eyebrow">Confirm</p>
              <p className="text-sm text-ink-soft">
                Costing must be approved, then Confirm locks the order &amp; builds the critical path.
              </p>
              <p className="text-sm">
                Costing:{" "}
                {po.costingApprovedAt ? (
                  <span className="font-medium text-ok">approved ✓</span>
                ) : (
                  <span className="font-medium text-warn">pending approval</span>
                )}
              </p>
              <div className="flex items-center gap-3 pt-2">
                {!po.costingApprovedAt && can(role, "costing", "approve") && (
                  <ApproveCostingButton poId={po.id} />
                )}
                <ConfirmButton poId={po.id} />
              </div>
            </div>
            <LotWidget poId={po.id} factoryId={po.factoryId} />
          </div>
        </>
      ) : (
        <p className="rounded-sm border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          This order is <span className="font-semibold">{po.status}</span> — order lines are locked.
        </p>
      )}

      {/* Critical Path + execution panels */}
      {milestones.length > 0 && (
        <TnaTimeline
          poId={po.id}
          milestones={milestones}
          canEdit={can(role, "criticalPath", "edit") && isActive}
        />
      )}
      {canSampling && (
        <SamplingPanel
          poId={po.id}
          samples={samples}
          colours={colours.map((c) => ({ id: c.id, name: c.name }))}
          canCreate={can(role, "sampling", "create") && isActive}
          canEdit={can(role, "sampling", "edit") && isActive}
        />
      )}
      {canPqc && !isDraft && production && (
        <ProductionPanel
          poId={po.id}
          production={production}
          canEdit={can(role, "productionQc", "edit") && isActive}
        />
      )}
      {canPqc && !isDraft && (
        <QcPanel
          poId={po.id}
          inspections={inspections}
          canCreate={can(role, "productionQc", "create") && isActive}
          canEdit={can(role, "productionQc", "edit") && isActive}
        />
      )}

      {canPqc && !isDraft && (
        <MaterialsPanel
          poId={po.id}
          materials={materials.map((m) => ({
            id: m.id,
            kind: m.kind,
            description: m.description,
            supplier: m.supplier,
            bookedQty: m.bookedQty != null ? Number(m.bookedQty) : null,
            unit: m.unit,
            bookingRef: m.bookingRef,
            etaDate: m.etaDate ? formatDate(m.etaDate) : null,
            etaDateRaw: m.etaDate ? new Date(m.etaDate).toISOString().slice(0, 10) : "",
            receivedQty: m.receivedQty != null ? Number(m.receivedQty) : null,
            receivedDate: m.receivedDate ? formatDate(m.receivedDate) : null,
            status: m.status,
          }))}
          canEdit={can(role, "productionQc", "edit") && isActive}
        />
      )}

      {canShip && !isDraft && (
        <div className="overflow-hidden rounded-sm border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Shipping balance</h3>
            {can(role, "shipment", "create") && isActive && hasBalance && (
              <Link
                href={`/shipments/new?poId=${po.id}`}
                className="rounded-sm bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                + New shipment
              </Link>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-1.5 font-semibold">Style</th>
                <th className="px-3 py-1.5 font-semibold">Colour</th>
                <th className="px-3 py-1.5 font-semibold">Remaining by size</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((l) => (
                <tr key={l.orderLineId} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 font-mono text-xs">{l.styleCode}</td>
                  <td className="px-3 py-1.5">{l.colour ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {l.sizes.map((s) => (
                        <span
                          key={s.label}
                          className={`tnum rounded-sm px-1.5 py-0.5 text-xs ${s.balance > 0 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}
                        >
                          {s.label}·{s.balance}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canDocs && (
        <DocumentsPanel
          entityType="PurchaseOrder"
          entityId={po.id}
          documents={documents}
          canCreate={can(role, "documents", "create") && isActive}
        />
      )}

      {canFinance && (
        <InvoicesPanel
          invoices={invoiceRows}
          poId={po.id}
          canManage={can(role, "finance", "create")}
        />
      )}

      {canCloseStatus && can(role, "orders", "edit") && (
        <div className="flex items-center gap-3 rounded-sm border border-line bg-surface p-5">
          <div className="space-y-0.5">
            <p className="eyebrow">Close</p>
            <p className="text-sm text-ink-soft">Mark this order complete (closes the back-to-back loop).</p>
          </div>
          <CloseButton poId={po.id} />
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface p-4">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
