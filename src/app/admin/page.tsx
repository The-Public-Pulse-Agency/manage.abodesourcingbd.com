import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/platform/companies";
import { listPackages } from "@/lib/platform/packages";
import { logoutAction } from "@/lib/auth/actions";
import { PlatformConsole, type CompanyRow, type PackageRow } from "@/components/platform-console";
import { BrandMark } from "@/components/brand-mark";
import { formatDate } from "@/lib/format";

export default async function AdminConsolePage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "SUPERADMIN") redirect("/dashboard");

  const [companies, packages] = await Promise.all([listCompanies(actor), listPackages(actor)]);

  const companyRows: CompanyRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    packageId: c.packageId,
    users: c.users,
    createdAt: formatDate(c.createdAt),
  }));
  const packageRows: PackageRow[] = packages.map((p) => ({
    id: p.id,
    name: p.name,
    priceBdt: p.priceBdt,
    periodDays: p.periodDays,
    active: p.active,
  }));

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-2">
            <BrandMark size="base" />
            <span className="ml-2 rounded-sm bg-accent-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase text-accent">Platform</span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-sm border border-line px-2.5 py-1 text-xs hover:border-accent hover:text-accent">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Platform console</h1>
          <p className="mt-1 text-sm text-ink-soft">Manage tenant companies, subscription packages, and billing across all of ABD Sourcing.</p>
        </div>
        <PlatformConsole companies={companyRows} packages={packageRows} />
      </main>
    </div>
  );
}
