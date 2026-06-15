import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBuyers, listBrands } from "@/lib/masterdata/buyer";
import { listFactories } from "@/lib/masterdata/factory";
import { NewOrderForm } from "./new-order-form";

export default async function NewOrderPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "create")) redirect("/orders");

  const [buyers, brands, factories] = await Promise.all([
    listBuyers(actor),
    listBrands(actor),
    listFactories(actor),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Merchandising</p>
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-sm text-ink-soft hover:text-accent">
            ← Orders
          </Link>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New purchase order</h1>
      </div>
      <NewOrderForm
        buyers={buyers.map((b) => ({ id: b.id, name: b.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name, buyerId: b.buyerId }))}
        factories={factories.map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
