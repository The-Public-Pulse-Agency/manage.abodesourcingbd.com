import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listOpenOrderBook } from "@/lib/orders/po";
import { listBuyers } from "@/lib/masterdata/buyer";
import { listFactories } from "@/lib/masterdata/factory";
import { orderChannels } from "@/lib/orders/schema";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

type SP = Record<string, string | undefined>;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const channel =
    sp.channel && (orderChannels as readonly string[]).includes(sp.channel)
      ? (sp.channel as (typeof orderChannels)[number])
      : undefined;

  const [orders, buyers, factories] = await Promise.all([
    listOpenOrderBook(actor, {
      factoryId: sp.factoryId || undefined,
      buyerId: sp.buyerId || undefined,
      channel,
    }),
    listBuyers(actor),
    listFactories(actor),
  ]);

  const footer = orders.reduce(
    (a, o) => ({
      qty: a.qty + o.totals.qty,
      value: Math.round((a.value + o.totals.value) * 100) / 100,
      margin: Math.round((a.margin + o.totals.margin) * 100) / 100,
    }),
    { qty: 0, value: 0, margin: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Merchandising</p>
          <h1 className="text-2xl font-semibold tracking-tight">Open Order Book</h1>
        </div>
        {can(actor.role, "orders", "create") && (
          <Link
            href="/orders/new"
            className="rounded-sm bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            + New order
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-sm border border-line bg-surface p-4">
        <Field label="Buyer">
          <select name="buyerId" defaultValue={sp.buyerId ?? ""} className="select">
            <option value="">All buyers</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Factory">
          <select name="factoryId" defaultValue={sp.factoryId ?? ""} className="select">
            <option value="">All factories</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Channel">
          <select name="channel" defaultValue={sp.channel ?? ""} className="select">
            <option value="">All channels</option>
            {orderChannels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <button type="submit" className="rounded-sm border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white">
          Filter
        </button>
        <Link href="/orders" className="self-center text-sm text-ink-soft hover:text-accent">
          Reset
        </Link>
      </form>

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">PO #</th>
              <th className="px-3 py-2 font-semibold">Buyer / Brand</th>
              <th className="px-3 py-2 font-semibold">Chan</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Ex-fty</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Value</th>
              <th className="px-3 py-2 text-right font-semibold">Margin</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-ink-soft">
                  No open orders. Create one to get started.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-3 py-2">
                  <Link href={`/orders/${o.id}`} className="font-mono font-medium text-accent hover:underline">
                    {o.poNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{o.buyer.name}</div>
                  <div className="text-xs text-ink-soft">{o.brand.name}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{o.channel}</td>
                <td className="px-3 py-2">{o.factory.name}</td>
                <td className="px-3 py-2"><StatusPill status={o.status} /></td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(o.exFactoryDate)}</td>
                <td className="px-3 py-2 text-right tnum">{formatQty(o.totals.qty)}</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(o.totals.value, o.currency)}</td>
                <td className="px-3 py-2 text-right tnum font-medium">{formatMoney(o.totals.margin, o.currency)}</td>
              </tr>
            ))}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2" colSpan={6}>{orders.length} orders</td>
                <td className="px-3 py-2 text-right tnum">{formatQty(footer.qty)}</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(footer.value)}</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(footer.margin)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
