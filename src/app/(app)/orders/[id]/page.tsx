import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { getPurchaseOrder } from "@/lib/orders/po";
import { lineTotals } from "@/lib/orders/money";
import { listStyles } from "@/lib/masterdata/style";
import { listColours, listSizeScales } from "@/lib/masterdata/sizescale";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { SizeGridForm } from "./size-grid-form";
import { ConfirmButton, RemoveLineButton, LotWidget } from "./order-detail-actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const { id } = await params;
  const po = await getPurchaseOrder(actor, id);
  if (!po) notFound();

  const canEdit = can(actor.role, "orders", "edit") && po.status === "DRAFT";
  const canDelete = can(actor.role, "orders", "delete") && po.status === "DRAFT";

  const [styles, colours, sizeScales] = canEdit
    ? await Promise.all([
        listStyles(actor, { brandId: po.brandId }),
        listColours(actor),
        listSizeScales(actor),
      ])
    : [[], [], []];

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
        </div>
      </div>

      {/* Meta + totals */}
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
          <Stat label="Margin" value={formatMoney(po.totals.margin, po.currency)} accent />
        </div>
      </div>

      {/* Lines */}
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
                Locks the order. Requires every size to have qty &gt; 0 and sell ≥ cost.
              </p>
              <div className="pt-2">
                <ConfirmButton poId={po.id} />
              </div>
            </div>
            <LotWidget poId={po.id} factoryId={po.factoryId} />
          </div>
        </>
      ) : (
        <p className="rounded-sm border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          This order is <span className="font-semibold">{po.status}</span> — lines are locked.
        </p>
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
