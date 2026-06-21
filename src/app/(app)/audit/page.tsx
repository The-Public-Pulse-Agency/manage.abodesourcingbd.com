import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listAuditLog, type AuditFilter } from "@/lib/audit/audit-view";
import { formatDateTime } from "@/lib/format";
import { ReportFilters } from "@/components/reports/report-filters";
import { Pagination } from "@/components/pagination";

const ACTION_CLS: Record<string, string> = {
  create: "bg-ok-soft text-ok",
  edit: "bg-warn-soft text-warn",
  delete: "bg-bad-soft text-bad",
  approve: "bg-accent-soft text-accent",
  login: "bg-paper text-ink-soft",
};

type SP = { page?: string; action?: string; entity?: string; user?: string; q?: string };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "auditLog", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const filter: AuditFilter = { action: sp.action, entityType: sp.entity, userId: sp.user, q: sp.q };
  const data = await listAuditLog(actor, filter, { page: Math.max(1, Number(sp.page) || 1) });

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Audit</p>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
          <p className="mt-1 text-sm text-ink-soft">Every create, edit, delete &amp; approval — who did what, and when.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
          {data.total} events
        </div>
      </div>

      <div className="rise space-y-3" style={{ animationDelay: "60ms" }}>
        <ReportFilters
          searchPlaceholder="Search entity type or id…"
          resultLabel={`${data.rows.length} on this page · ${data.total} total`}
          selects={[
            { param: "action", allLabel: "All actions", options: ["create", "edit", "delete", "approve", "login"].map((a) => ({ value: a, label: a })) },
            { param: "entity", allLabel: "All types", options: data.entityTypes.map((e) => ({ value: e, label: e })) },
            { param: "user", allLabel: "All users", options: data.users },
          ]}
        />

        <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
          <table className="list-table w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">User</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-ink-soft">No activity matches.</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-2 tnum text-xs text-ink-soft">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2 text-xs font-medium">{r.user}</td>
                  <td className="px-3 py-2"><span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${ACTION_CLS[r.action] ?? "bg-paper text-ink-soft"}`}>{r.action}</span></td>
                  <td className="px-3 py-2 text-xs">{r.entityType}</td>
                  <td className="px-3 py-2 max-w-[34rem] truncate text-xs text-ink-soft" title={r.detail}>{r.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} params={sp} />
      </div>
    </div>
  );
}
