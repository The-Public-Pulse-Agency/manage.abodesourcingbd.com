import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { ImportForm } from "./import-form";
import { OrderImportForm } from "./order-import-form";
import { DangerZone } from "./danger-zone";

export default async function ImportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "masterData", "create")) redirect("/dashboard");
  const canOrders = can(actor, "orders", "create");
  const isAdmin = actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Data</p>
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
      </div>

      {canOrders && (
        <section className="rounded-lg border border-line bg-surface p-5 elevate">
          <h2 className="font-semibold">Import orders from Excel</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Download the template, fill one row per size (PO Number, Buyer, Brand, Factory, Style, Colour, Size,
            Qty, Net/Sell FOB, dates), then upload it. Buyers, brands, factories, styles &amp; colours are created
            automatically; each PO is added as a DRAFT with its lines.
          </p>
          <a
            href="/api/import/order-template"
            className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-accent hover:border-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Download Excel template
          </a>
          <div className="mt-4 border-t border-line pt-4">
            <OrderImportForm />
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-surface p-5 elevate">
        <h2 className="font-semibold">Import master data</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Upload the BD open-orders .xlsx — factories, buyers, brands and styles are extracted, de-duplicated and
          added. Re-running is safe (idempotent).
        </p>
        <div className="mt-4">
          <ImportForm />
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-lg border border-bad/40 bg-bad-soft/40 p-5">
          <h2 className="font-semibold text-bad">Danger zone</h2>
          <div className="mt-3">
            <DangerZone />
          </div>
        </section>
      )}
    </div>
  );
}
