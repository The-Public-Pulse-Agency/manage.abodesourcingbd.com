"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createEnquiryAction, updateEnquiryAction, convertEnquiryAction } from "@/lib/enquiries/form-actions";

export type EnquiryRow = {
  id: string;
  buyerName: string;
  brandName: string;
  factoryName: string | null;
  styleRef: string;
  targetQty: number | null;
  targetPriceUsd: number | null;
  quotedPriceUsd: number | null;
  requiredShipDate: string | null;
  status: string;
  convertedPoId: string | null;
};
type Opt = { id: string; name: string };
type BrandOpt = { id: string; name: string; buyerId: string };

const STATUSES = ["NEW", "QUOTING", "QUOTED", "WON", "LOST", "DROPPED"];
const STATUS_CLS: Record<string, string> = {
  NEW: "bg-line text-ink-soft",
  QUOTING: "bg-warn-soft text-warn",
  QUOTED: "bg-accent-soft text-accent",
  WON: "bg-ok-soft text-ok",
  LOST: "bg-bad-soft text-bad",
  DROPPED: "bg-line text-ink-soft",
};

export function EnquiryManager({
  rows,
  buyers,
  brands,
  factories,
  canEdit,
}: {
  rows: EnquiryRow[];
  buyers: Opt[];
  brands: BrandOpt[];
  factories: Opt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const brandOpts = brands.filter((b) => !buyerId || b.buyerId === buyerId);

  async function setStatus(id: string, status: string) {
    const r = await updateEnquiryAction(id, { status });
    if (!r.ok) setMsg(r.error);
    else router.refresh();
  }
  async function setQuote(id: string, v: string) {
    const n = Number(v);
    if (!v || Number.isNaN(n)) return;
    const r = await updateEnquiryAction(id, { quotedPriceUsd: n });
    if (!r.ok) setMsg(r.error);
    else router.refresh();
  }
  async function convert(id: string) {
    const r = await convertEnquiryAction(id);
    if (r.ok && r.poId) router.push(`/orders/${r.poId}`);
    else if (!r.ok) setMsg(r.error);
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-bad">{msg}</p>}
      <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Buyer / Brand</th>
              <th className="px-3 py-2 font-semibold">Style</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Target $</th>
              <th className="px-3 py-2 text-right font-semibold">Quoted $</th>
              <th className="px-3 py-2 font-semibold">Req. ship</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-ink-soft">No enquiries yet.</td></tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  {canEdit && !e.convertedPoId ? (
                    <select aria-label="Status" defaultValue={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} className="select text-xs">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[e.status] ?? ""}`}>{e.status}</span>
                  )}
                </td>
                <td className="px-3 py-2"><div className="font-medium">{e.buyerName}</div><div className="text-xs text-ink-soft">{e.brandName}</div></td>
                <td className="px-3 py-2">{e.styleRef}</td>
                <td className="px-3 py-2">{e.factoryName ?? <span className="text-ink-soft">—</span>}</td>
                <td className="px-3 py-2 text-right tnum">{e.targetQty ?? "—"}</td>
                <td className="px-3 py-2 text-right tnum">{e.targetPriceUsd ?? "—"}</td>
                <td className="px-3 py-2 text-right tnum">
                  {canEdit && !e.convertedPoId ? (
                    <input aria-label="Quoted price" defaultValue={e.quotedPriceUsd ?? ""} onBlur={(ev) => setQuote(e.id, ev.target.value)} inputMode="decimal" className="input tnum w-20 text-right text-xs" />
                  ) : (e.quotedPriceUsd ?? "—")}
                </td>
                <td className="px-3 py-2 tnum text-xs">{e.requiredShipDate ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {e.convertedPoId ? (
                    <Link href={`/orders/${e.convertedPoId}`} className="text-xs text-accent hover:underline">View order →</Link>
                  ) : canEdit ? (
                    <button type="button" onClick={() => convert(e.id)} className="rounded-sm bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90">Convert to order</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form
          action={async (fd) => { const r = await createEnquiryAction(fd); if (r.ok) { setMsg(null); router.refresh(); } else setMsg(r.error); }}
          className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4 elevate"
        >
          <p className="eyebrow w-full">New enquiry</p>
          <select name="buyerId" required aria-label="Buyer" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="select text-xs">
            <option value="">Buyer…</option>
            {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select name="brandId" required aria-label="Brand" className="select text-xs">
            <option value="">Brand…</option>
            {brandOpts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select name="factoryId" aria-label="Factory" className="select text-xs">
            <option value="">Factory (optional)…</option>
            {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input name="styleRef" placeholder="Style ref" required className="input text-xs" aria-label="Style reference" />
          <input name="targetQty" inputMode="numeric" placeholder="Qty" className="input tnum w-20 text-right text-xs" aria-label="Target qty" />
          <input name="targetPriceUsd" inputMode="decimal" placeholder="Target $" className="input tnum w-24 text-right text-xs" aria-label="Target price" />
          <input name="requiredShipDate" type="date" className="input text-xs" aria-label="Required ship date" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add enquiry</button>
        </form>
      )}
    </div>
  );
}
