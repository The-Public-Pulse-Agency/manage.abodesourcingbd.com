import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listTemplates } from "@/lib/tna/templates";
import { TemplateManager, type TemplateRow } from "@/components/settings/template-manager";

export default async function SettingsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!can(actor.role, "criticalPath", "view")) redirect("/dashboard");
  const canEdit = can(actor.role, "criticalPath", "edit");

  const templates = await listTemplates(actor, true);
  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id, key: t.key, name: t.name, stage: t.stage, offsetDays: t.offsetDays, position: t.position, active: t.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Critical Path (T&amp;A) template</h2>
            <p className="text-sm text-ink-soft">
              The milestone schedule new orders inherit on confirm — back-scheduled from the ex-factory date
              (negative offset = days before ex-fty). Fully customisable; existing orders keep their snapshot.
            </p>
          </div>
        </div>
        <TemplateManager templates={rows} canEdit={canEdit} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Other settings</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingLink href="/billing" title="Billing &amp; subscription" desc="Plan fee, period, SLA, payments" />
          <SettingLink href="/master-data/factories" title="Factories" desc="Manufacturing partners" />
          <SettingLink href="/master-data/buyers" title="Buyers & brands" desc="Customers and their brands" />
          <SettingLink href="/master-data/size-scales" title="Size scales" desc="Size sets used on orders" />
          <SettingLink href="/master-data/colours" title="Colours" desc="Colour master list" />
          <SettingLink href="/users" title="Users & roles" desc="Team access" />
        </div>
      </section>
    </div>
  );
}

function SettingLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card-hover elevate block rounded-md border border-line bg-surface p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>
    </Link>
  );
}
