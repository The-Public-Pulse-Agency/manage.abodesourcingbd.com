import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getPurchaseOrder, listOpenOrderBook } from "@/lib/orders/po";
import { getPoBalance } from "@/lib/shipment/balance-db";
import { listForwarders, listPorts } from "@/lib/masterdata/logistics";
import { NewShipmentForm } from "./new-shipment-form";

const SHIPPABLE = ["CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"];

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "shipment", "create")) redirect("/shipments");
  const { poId } = await searchParams;

  if (!poId) {
    const book = await listOpenOrderBook(actor, {});
    const shippable = book.filter((p) => SHIPPABLE.includes(p.status));
    return (
      <div className="space-y-6">
        <div>
          <p className="eyebrow">Logistics</p>
          <h1 className="text-2xl font-semibold tracking-tight">New shipment — pick an order</h1>
        </div>
        <div className="overflow-hidden rounded-sm border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 font-semibold">Buyer / Brand</th>
                <th className="px-3 py-2 font-semibold">Factory</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {shippable.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-10 text-center text-ink-soft">No confirmed orders ready to ship.</td></tr>
              )}
              {shippable.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-3 py-2">
                    <Link href={`/shipments/new?poId=${p.id}`} className="font-mono font-medium text-accent hover:underline">
                      {p.poNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.buyer.name} · <span className="text-ink-soft">{p.brand.name}</span></td>
                  <td className="px-3 py-2">{p.factory.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const po = await getPurchaseOrder(actor, poId);
  if (!po) notFound();
  const [balance, forwarders, ports] = await Promise.all([
    getPoBalance(actor, poId),
    listForwarders(actor),
    listPorts(actor),
  ]);
  const lines = balance
    .map((l) => ({
      orderLineId: l.orderLineId,
      styleCode: l.styleCode,
      colour: l.colour,
      sizes: l.sizes.filter((s) => s.balance > 0).map((s) => ({ label: s.label, balance: s.balance })),
    }))
    .filter((l) => l.sizes.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/orders/${po.id}`} className="text-sm text-ink-soft hover:text-accent">← {po.poNumber}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New shipment</h1>
      </div>
      <NewShipmentForm
        poNumber={po.poNumber}
        lines={lines}
        forwarders={forwarders.map((f) => ({ id: f.id, name: f.name }))}
        ports={ports.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
