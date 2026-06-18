"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPackageAction, updatePackageAction, setCompanyStatusAction, setCompanyPackageAction } from "@/lib/platform/form-actions";

export type CompanyRow = { id: string; name: string; slug: string; status: string; packageId: string | null; users: number; createdAt: string };
export type PackageRow = { id: string; name: string; priceBdt: number; periodDays: number; active: boolean };

export function PlatformConsole({ companies, packages }: { companies: CompanyRow[]; packages: PackageRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const pkgName = (id: string | null) => packages.find((p) => p.id === id)?.name ?? "—";

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    const r = await p;
    if (!r.ok) setMsg(r.error ?? "Failed");
    else { setMsg(null); router.refresh(); }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-bad">{msg}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Companies <span className="text-sm font-normal text-ink-soft">({companies.length})</span></h2>
        <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 font-semibold">Company</th>
                <th className="px-3 py-2 font-semibold">Slug</th>
                <th className="px-3 py-2 text-right font-semibold">Users</th>
                <th className="px-3 py-2 font-semibold">Package</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-soft">No companies yet.</td></tr>}
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-soft">{c.slug}</td>
                  <td className="px-3 py-2 text-right tnum">{c.users}</td>
                  <td className="px-3 py-2">
                    <select aria-label="Package" defaultValue={c.packageId ?? ""} onChange={(e) => run(setCompanyPackageAction(c.id, e.target.value))} className="select text-xs">
                      <option value="">— none —</option>
                      {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => run(setCompanyStatusAction(c.id, c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"))}
                      className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${c.status === "ACTIVE" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}
                    >
                      {c.status}
                    </button>
                  </td>
                  <td className="px-3 py-2 tnum text-xs text-ink-soft">{c.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-soft">Click a status to toggle suspend/activate. Package changes apply immediately.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Packages</h2>
        <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 text-right font-semibold">Price (৳)</th>
                <th className="px-3 py-2 text-right font-semibold">Period (days)</th>
                <th className="px-3 py-2 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-right tnum">{p.priceBdt.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tnum">{p.periodDays}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => run(updatePackageAction(p.id, { active: !p.active }))} className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${p.active ? "bg-ok-soft text-ok" : "bg-line text-ink-soft"}`}>
                      {p.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            action={async (fd) => run(createPackageAction(fd))}
            className="flex flex-wrap items-end gap-2 border-t border-line p-3"
          >
            <input name="name" placeholder="Package name" required className="input text-xs" aria-label="Package name" />
            <input name="priceBdt" type="number" min="0" placeholder="Price ৳" required className="input tnum w-24 text-right text-xs" aria-label="Price BDT" />
            <input name="periodDays" type="number" min="1" defaultValue={30} className="input tnum w-24 text-right text-xs" aria-label="Period days" />
            <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add package</button>
          </form>
        </div>
      </section>
    </div>
  );
}
