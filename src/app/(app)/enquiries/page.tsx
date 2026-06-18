import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listEnquiries, enquiryPipelineKpis } from "@/lib/enquiries/enquiries";
import { listBuyers, listBrands } from "@/lib/masterdata/buyer";
import { listFactories } from "@/lib/masterdata/factory";
import { EnquiryManager, type EnquiryRow } from "@/components/enquiry-manager";
import { formatMoney, formatQty, formatDate } from "@/lib/format";

export default async function EnquiriesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const canEdit = can(actor.role, "orders", "create");

  const [enquiries, buyers, brands, factories, kpis] = await Promise.all([
    listEnquiries(actor),
    listBuyers(actor),
    listBrands(actor),
    listFactories(actor),
    enquiryPipelineKpis(actor),
  ]);

  const buyerName = new Map(buyers.map((b) => [b.id, b.name]));
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const factoryName = new Map(factories.map((f) => [f.id, f.name]));

  const rows: EnquiryRow[] = enquiries.map((e) => ({
    id: e.id,
    buyerName: buyerName.get(e.buyerId) ?? "—",
    brandName: brandName.get(e.brandId) ?? "—",
    factoryId: e.factoryId,
    factoryName: e.factoryId ? factoryName.get(e.factoryId) ?? null : null,
    styleRef: e.styleRef,
    targetQty: e.targetQty,
    targetPriceUsd: e.targetPriceUsd != null ? Number(e.targetPriceUsd) : null,
    quotedPriceUsd: e.quotedPriceUsd != null ? Number(e.quotedPriceUsd) : null,
    requiredShipDate: e.requiredShipDate ? formatDate(e.requiredShipDate) : null,
    requiredShipDateRaw: e.requiredShipDate ? e.requiredShipDate.toISOString().slice(0, 10) : null,
    priceQuotedDateRaw: e.priceQuotedDate ? e.priceQuotedDate.toISOString().slice(0, 10) : null,
    fabricComposition: e.fabricComposition,
    notes: e.notes,
    status: e.status,
    convertedPoId: e.convertedPoId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Merchandising</p>
        <h1 className="text-2xl font-semibold tracking-tight">Enquiries &amp; Quotations</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Open enquiries" value={formatQty(kpis.openCount)} />
        <Stat label="Open pipeline value (USD)" value={formatMoney(kpis.openValueUsd)} />
        <Stat label="Win rate" value={kpis.wonRate === null ? "—" : `${kpis.wonRate}%`} />
      </div>

      <EnquiryManager
        rows={rows}
        buyers={buyers.map((b) => ({ id: b.id, name: b.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name, buyerId: b.buyerId }))}
        factories={factories.map((f) => ({ id: f.id, name: f.name }))}
        canEdit={canEdit}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 elevate">
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
