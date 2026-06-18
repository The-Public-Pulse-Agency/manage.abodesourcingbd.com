"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANY_MODULES, ACTIONS, MODULE_LABELS, type Action, type PermissionMap } from "@/lib/auth/permissions";
import { createRoleAction, updateRoleAction, deleteRoleAction } from "@/lib/auth/role-form-actions";

export type RoleRow = { id: string; key: string; name: string; isSystem: boolean; permissions: PermissionMap };

function RoleCard({ role, canManage }: { role: RoleRow; canManage: boolean }) {
  const router = useRouter();
  const [perms, setPerms] = useState<PermissionMap>(() => structuredClone(role.permissions ?? {}));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const has = (m: string, a: Action) => (perms[m as keyof PermissionMap] ?? []).includes(a);
  function toggle(m: string, a: Action) {
    setPerms((prev) => {
      const cur = new Set(prev[m as keyof PermissionMap] ?? []);
      if (cur.has(a)) cur.delete(a);
      else cur.add(a);
      const next = { ...prev };
      const arr = ACTIONS.filter((x) => cur.has(x));
      if (arr.length) next[m as keyof PermissionMap] = arr;
      else delete next[m as keyof PermissionMap];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await updateRoleAction(role.id, { permissions: perms });
    setBusy(false);
    if (r.error) setMsg(r.error);
    else { setMsg("Saved ✓"); router.refresh(); }
  }
  async function del() {
    setBusy(true);
    const r = await deleteRoleAction(role.id);
    setBusy(false);
    if (r.error) { setMsg(r.error); setConfirmDel(false); }
    else router.refresh();
  }

  return (
    <div className="rounded-md border border-line bg-surface elevate">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{role.name}</span>
          <span className="font-mono text-[0.625rem] text-ink-soft">{role.key}</span>
          {role.isSystem && <span className="rounded-sm bg-line px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-ink-soft">system</span>}
        </div>
        {msg && <span className={`text-xs ${msg.startsWith("Saved") ? "text-ok" : "text-bad"}`}>{msg}</span>}
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="px-2 py-1 font-semibold">Module</th>
              {ACTIONS.map((a) => <th key={a} className="px-2 py-1 text-center font-semibold capitalize">{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {COMPANY_MODULES.map((m) => (
              <tr key={m} className="border-t border-line">
                <td className="px-2 py-1">{MODULE_LABELS[m] ?? m}</td>
                {ACTIONS.map((a) => (
                  <td key={a} className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${m} ${a}`}
                      checked={has(m, a)}
                      disabled={!canManage}
                      onChange={() => toggle(m, a)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
          <button type="button" onClick={save} disabled={busy} className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save permissions"}
          </button>
          {!role.isSystem && (
            confirmDel ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-bad">Delete role?</span>
                <button type="button" onClick={del} disabled={busy} className="rounded-sm bg-bad px-2 py-1 font-medium text-white disabled:opacity-50">Yes</button>
                <button type="button" onClick={() => setConfirmDel(false)} className="text-ink-soft hover:text-accent">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-ink-soft hover:text-bad">Delete role</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function RoleManager({ roles, canManage }: { roles: RoleRow[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await createRoleAction(name.trim(), {});
    setBusy(false);
    if (r.error) setMsg(r.error);
    else { setName(""); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3 elevate">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink-soft">New role name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. QC Lead" className="input text-sm" />
          </label>
          <button type="button" onClick={create} disabled={busy || !name.trim()} className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {busy ? "Creating…" : "+ Add role"}
          </button>
          <span className="text-xs text-ink-soft">Then tick permissions below and Save.</span>
          {msg && <span className="text-xs text-bad">{msg}</span>}
        </div>
      )}
      {roles.map((r) => <RoleCard key={r.id} role={r} canManage={canManage} />)}
    </div>
  );
}
