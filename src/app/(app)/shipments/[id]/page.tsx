import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, tenantId } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getShipment } from "@/lib/shipment/shipment";
import { listDocuments } from "@/lib/documents/documents";
import { listForwarders, listPorts } from "@/lib/masterdata/logistics";
import { formatDate, formatQty } from "@/lib/format";
import { ShipmentTelexForm } from "./shipment-telex-form";
import { DocumentsPanel } from "@/components/documents-panel";
import { InvoicesPanel, type InvoiceRow } from "@/components/invoices-panel";
import { listInvoices } from "@/lib/finance/invoices";
import { outstanding } from "@/lib/finance/money";
import { EditableCell } from "@/components/reports/editable-cell";
import { setShipmentReference, setShipmentLineSizeQty } from "@/lib/reports/inline-actions";

function dateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

// Documents a shipment should carry before it leaves the factory.
const REQUIRED_DOCS = [
  { type: "BL", label: "Bill of Lading" },
  { type: "COMMERCIAL_INVOICE", label: "Commercial Invoice" },
  { type: "PACKING_LIST", label: "Packing List" },
  { type: "TEST_CERT", label: "Test Cert" },
] as const;

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "shipment", "view")) redirect("/dashboard");
  const { id } = await params;
  const shp = await getShipment(actor, id);
  if (!shp) notFound();

  const canEdit = can(actor.role, "shipment", "edit");
  const [forwarders, ports] = canEdit
    ? await Promise.all([listForwarders(actor), listPorts(actor)])
    : [[], []];
  const inv = shp.invoices.find((i) => i.type === "FACTORY") ?? shp.invoices[0];

  // Distinct POs this shipment covers — used to surface "create invoice from shipment"
  // by reusing InvoicesPanel scoped to each PO (the established order-detail pattern).
  const canFinance = can(actor.role, "finance", "view");
  const pos = canFinance
    ? Array.from(new Map(shp.lines.map((l) => [l.orderLine.po.id, l.orderLine.po])).values())
    : [];
  // Shipped sell-value per PO (this shipment's qty × order-line sell price), used to
  // pre-fill the buyer-invoice amount so it doesn't have to be keyed in by hand.
  const olIds = canFinance ? [...new Set(shp.lines.map((l) => l.orderLine.id))] : [];
  const olSizes = olIds.length
    ? await prisma.orderLineSize.findMany({
        where: { orderLineId: { in: olIds }, companyId: tenantId(actor) },
        select: { orderLineId: true, label: true, sellFob: true },
      })
    : [];
  const sellBy = new Map(olSizes.map((s) => [`${s.orderLineId}:${s.label}`, Number(s.sellFob)]));
  const shippedValueByPo = new Map<string, number>();
  for (const l of shp.lines) {
    const v = l.sizes.reduce((sum, z) => sum + z.qty * (sellBy.get(`${l.orderLine.id}:${z.label}`) ?? 0), 0);
    shippedValueByPo.set(l.orderLine.po.id, (shippedValueByPo.get(l.orderLine.po.id) ?? 0) + v);
  }

  const invoicesByPo = await Promise.all(
    pos.map(async (po) => {
      const invoices = await listInvoices(actor, { poId: po.id });
      const isoDay = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
      const rows: InvoiceRow[] = invoices.map((i) => ({
        id: i.id,
        type: i.type,
        number: i.number,
        amount: Number(i.amount),
        outstanding: i.status === "PAID" ? 0 : outstanding(i.amount, i.payments),
        status: i.status,
        currency: i.currency,
        poId: i.poId,
        issueDate: isoDay(i.issueDate),
        dueDate: isoDay(i.dueDate),
        payments: i.payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, paidDate: isoDay(p.date) ?? "" })),
      }));
      return { po, rows };
    }),
  );

  const canDocs = can(actor.role, "documents", "view");
  const documents = canDocs ? await listDocuments(actor, "Shipment", id) : [];
  const haveDocTypes = new Set(documents.map((d) => d.type));
  const docsPresent = REQUIRED_DOCS.filter((r) => haveDocTypes.has(r.type)).length;
  const docsPct = Math.round((docsPresent / REQUIRED_DOCS.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/shipments" className="text-sm text-ink-soft hover:text-accent">← Shipments</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{shp.reference}</h1>
          <span className="font-mono text-xs text-ink-soft">{shp.mode}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-sm border border-line bg-surface p-5 sm:grid-cols-4">
        <div>
          <dt className="eyebrow">Reference</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {canEdit ? (
              <EditableCell id={shp.id} raw={shp.reference} action={setShipmentReference}>
                <span className="font-mono">{shp.reference}</span>
              </EditableCell>
            ) : (
              <span className="font-mono">{shp.reference}</span>
            )}
          </dd>
        </div>
        <Meta label="Container" value={shp.containerNo ?? "—"} />
        <Meta label="Cartons" value={shp.cartons?.toString() ?? "—"} />
        <Meta label="Ex-factory" value={formatDate(shp.exFactoryDate)} />
        <Meta label="Telex" value={shp.telexStatus} />
        <Meta label="BL number" value={shp.blNumber ?? "—"} />
        <Meta label="BL date" value={formatDate(shp.blDate)} />
        <Meta label="Forwarder" value={shp.forwarder?.name ?? "—"} />
        <Meta label="Port" value={shp.port?.name ?? "—"} />
        <Meta label="ETA destination" value={formatDate(shp.etaDestination)} />
        <Meta label="TC status" value={shp.tcStatus ?? "—"} />
        <Meta label="Payment" value={inv ? (inv.status === "PAID" ? "Paid" : inv.status === "PARTIALLY_PAID" ? "Partial" : "Due") : "—"} />
        <Meta label="Remarks" value={shp.remarks ?? "—"} />
      </dl>

      {canEdit && (
        <ShipmentTelexForm
          shipmentId={shp.id}
          forwarders={forwarders.map((x) => ({ id: x.id, name: x.name }))}
          ports={ports.map((x) => ({ id: x.id, name: x.name }))}
          current={{
            containerNo: shp.containerNo ?? "",
            cartons: shp.cartons?.toString() ?? "",
            mode: shp.mode,
            exFactoryDate: dateInput(shp.exFactoryDate),
            blNumber: shp.blNumber ?? "",
            blDate: dateInput(shp.blDate),
            etaDestination: dateInput(shp.etaDestination),
            telexStatus: shp.telexStatus,
            tcStatus: shp.tcStatus ?? "",
            forwarderId: shp.forwarderId ?? "",
            portId: shp.portId ?? "",
            remarks: shp.remarks ?? "",
            invoiceId: inv?.id ?? null,
            paymentStatus: inv?.status ?? "ISSUED",
          }}
        />
      )}

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">PO</th>
              <th className="px-3 py-2 font-semibold">Style</th>
              <th className="px-3 py-2 font-semibold">Colour</th>
              <th className="px-3 py-2 font-semibold">Sizes</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody>
            {shp.lines.map((l) => {
              const qty = l.sizes.reduce((a, s) => a + s.qty, 0);
              return (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/orders/${l.orderLine.po.id}`} className="font-mono text-accent hover:underline">
                      {l.orderLine.po.poNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{l.orderLine.style.styleCode}</td>
                  <td className="px-3 py-2">{l.orderLine.colour?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {l.sizes.map((s) => (
                        <span key={s.id} className="tnum inline-flex items-center gap-0.5 rounded-sm bg-paper px-1.5 py-0.5 text-xs">
                          <span>{s.label}·</span>
                          {canEdit ? (
                            <span className="w-10">
                              <EditableCell
                                id={s.id}
                                raw={String(s.qty)}
                                action={setShipmentLineSizeQty}
                                type="number"
                                align="right"
                              >
                                <span className="tnum">{s.qty}</span>
                              </EditableCell>
                            </span>
                          ) : (
                            <span>{s.qty}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tnum">{formatQty(qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canFinance && invoicesByPo.map(({ po, rows }) => (
        <InvoicesPanel
          key={po.id}
          invoices={rows}
          poId={po.id}
          canManage={can(actor.role, "finance", "create")}
          title={invoicesByPo.length > 1 ? `Invoices · ${po.poNumber}` : "Invoices"}
          defaultNumber={shp.reference}
          defaultAmount={Math.round((shippedValueByPo.get(po.id) ?? 0) * 100) / 100}
        />
      ))}

      {canDocs && (
        <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Document checklist</h3>
            <span className="tnum text-xs text-ink-soft">{docsPresent}/{REQUIRED_DOCS.length} required</span>
          </div>
          <div className="p-4">
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full ${docsPct === 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${docsPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_DOCS.map((r) => {
                const ok = haveDocTypes.has(r.type);
                return (
                  <span key={r.type} className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs ${ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                    {ok ? "✓" : "✗"} {r.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {canDocs && (
        <DocumentsPanel
          entityType="Shipment"
          entityId={shp.id}
          documents={documents}
          canCreate={can(actor.role, "documents", "create")}
        />
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
