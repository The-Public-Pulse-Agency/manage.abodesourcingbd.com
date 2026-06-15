import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getShipment } from "@/lib/shipment/shipment";
import { listDocuments } from "@/lib/documents/documents";
import { formatDate, formatQty } from "@/lib/format";
import { ShipmentTelexForm } from "./shipment-telex-form";
import { DocumentsPanel } from "@/components/documents-panel";

function dateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "shipment", "view")) redirect("/dashboard");
  const { id } = await params;
  const shp = await getShipment(actor, id);
  if (!shp) notFound();

  const canEdit = can(actor.role, "shipment", "edit");
  const canDocs = can(actor.role, "documents", "view");
  const documents = canDocs ? await listDocuments(actor, "Shipment", id) : [];

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
        <Meta label="Container" value={shp.containerNo ?? "—"} />
        <Meta label="Cartons" value={shp.cartons?.toString() ?? "—"} />
        <Meta label="Ex-factory" value={formatDate(shp.exFactoryDate)} />
        <Meta label="Telex" value={shp.telexStatus} />
        <Meta label="BL number" value={shp.blNumber ?? "—"} />
        <Meta label="BL date" value={formatDate(shp.blDate)} />
        <Meta label="Forwarder" value={shp.forwarder?.name ?? "—"} />
        <Meta label="Port" value={shp.port?.name ?? "—"} />
      </dl>

      {canEdit && (
        <ShipmentTelexForm
          shipmentId={shp.id}
          current={{
            containerNo: shp.containerNo ?? "",
            cartons: shp.cartons?.toString() ?? "",
            blNumber: shp.blNumber ?? "",
            blDate: dateInput(shp.blDate),
            telexStatus: shp.telexStatus,
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
                        <span key={s.id} className="tnum rounded-sm bg-paper px-1.5 py-0.5 text-xs">{s.label}·{s.qty}</span>
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
