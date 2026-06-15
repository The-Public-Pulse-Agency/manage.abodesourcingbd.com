"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplateAction, updateTemplateAction, toggleTemplateAction } from "@/lib/tna/template-form-actions";

export type TemplateRow = {
  id: string;
  key: string;
  name: string;
  stage: string;
  offsetDays: number | null;
  position: number;
  active: boolean;
};

const STAGES = ["PRE_PRODUCTION", "SAMPLING", "PRODUCTION_QC", "SHIPPING"];

export function TemplateManager({ templates, canEdit }: { templates: TemplateRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Milestone</th>
              <th className="px-3 py-2 font-semibold">Stage</th>
              <th className="px-3 py-2 text-right font-semibold">Offset (days)</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) =>
              editing === t.id ? (
                <tr key={t.id} className="border-b border-line bg-accent-soft/40 align-top last:border-0">
                  <td colSpan={canEdit ? 6 : 5} className="px-3 py-3">
                    <form
                      action={async (fd) => {
                        const r = await updateTemplateAction(t.id, fd);
                        if (r.ok) { setEditing(null); setMsg(null); router.refresh(); } else setMsg(r.error);
                      }}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <Field label="Position"><input name="position" type="number" defaultValue={t.position} className="input tnum w-20" /></Field>
                      <Field label="Name"><input name="name" defaultValue={t.name} required className="input" /></Field>
                      <Field label="Stage">
                        <select name="stage" defaultValue={t.stage} className="select">
                          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Offset (days, − before ex-fty)"><input name="offsetDays" type="number" defaultValue={t.offsetDays ?? 0} className="input tnum w-24" /></Field>
                      <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Save</button>
                      <button type="button" onClick={() => { setEditing(null); setMsg(null); }} className="text-sm text-ink-soft hover:text-accent">Cancel</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className={`border-b border-line last:border-0 ${t.active ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 tnum text-xs text-ink-soft">{t.position}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-ink-soft">{t.key}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{t.stage}</td>
                  <td className="px-3 py-2 text-right tnum">{t.offsetDays ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${t.active ? "bg-ok-soft text-ok" : "bg-line text-ink-soft"}`}>
                      {t.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setEditing(t.id)} className="mr-3 text-xs text-accent hover:underline">Edit</button>
                      <button
                        type="button"
                        onClick={async () => { await toggleTemplateAction(t.id, !t.active); router.refresh(); }}
                        className="text-xs text-ink-soft hover:text-accent"
                      >
                        {t.active ? "Archive" : "Restore"}
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form
          action={async (fd) => {
            const r = await createTemplateAction(fd);
            if (r.ok) { setMsg(null); router.refresh(); (document.getElementById("tpl-add") as HTMLFormElement)?.reset(); } else setMsg(r.error);
          }}
          id="tpl-add"
          className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
        >
          <p className="eyebrow w-full">Add milestone</p>
          <Field label="Position"><input name="position" type="number" defaultValue={templates.length} className="input tnum w-20" /></Field>
          <Field label="Key"><input name="key" placeholder="pp_sample" required className="input" /></Field>
          <Field label="Name"><input name="name" placeholder="PP sample approved" required className="input" /></Field>
          <Field label="Stage">
            <select name="stage" className="select">{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          <Field label="Offset (days)"><input name="offsetDays" type="number" placeholder="-45" className="input tnum w-24" /></Field>
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Add</button>
        </form>
      )}
      {msg && <p className="text-sm text-bad">{msg}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
