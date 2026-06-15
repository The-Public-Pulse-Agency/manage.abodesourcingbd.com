import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listShipments } from "@/lib/shipment/shipment";
import { formatDate } from "@/lib/format";

const TELEX_CLS: Record<string, string> = {
  PENDING: "bg-line text-ink-soft",
  RECEIVED: "bg-warn-soft text-warn",
  RELEASED: "bg-ok-soft text-ok",
};

export default async function ShipmentsPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "shipment", "view")) redirect("/dashboard");
  const shipments = await listShipments(actor);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Logistics</p>
        <h1 className="text-2xl font-semibold tracking-tight">Shipments</h1>
      </div>
      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Reference</th>
              <th className="px-3 py-2 font-semibold">Mode</th>
              <th className="px-3 py-2 font-semibold">Container</th>
              <th className="px-3 py-2 font-semibold">BL</th>
              <th className="px-3 py-2 font-semibold">Telex</th>
              <th className="px-3 py-2 font-semibold">Ex-fty</th>
              <th className="px-3 py-2 text-right font-semibold">Lines</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">No shipments yet.</td></tr>
            )}
            {shipments.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-3 py-2">
                  <Link href={`/shipments/${s.id}`} className="font-mono font-medium text-accent hover:underline">
                    {s.reference}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{s.mode}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.containerNo ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.blNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${TELEX_CLS[s.telexStatus] ?? ""}`}>
                    {s.telexStatus}
                  </span>
                </td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(s.exFactoryDate)}</td>
                <td className="px-3 py-2 text-right tnum">{s.lines.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
