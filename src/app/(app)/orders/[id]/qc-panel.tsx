"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addInspectionAction,
  setInspectionResult,
  setInspectionType,
  setInspectionDate,
  setInspectionAql,
  setInspectionRemarks,
  deleteInspectionAction,
} from "@/lib/qc/form-actions";
import { EditableCell } from "@/components/reports/editable-cell";
import { RowDeleteButton } from "@/components/reports/row-delete-button";

type Inspection = {
  id: string;
  type: string;
  result: string;
  date: string | Date;
  aql: string | null;
  remarks: string | null;
};

function fmt(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function isoDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);
const TYPE_OPTIONS = [
  { value: "INLINE", label: "INLINE" },
  { value: "FINAL", label: "FINAL" },
];
const RESULT_OPTIONS = [
  { value: "PASS", label: "PASS" },
  { value: "FAIL", label: "FAIL" },
];

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold ${result === "PASS" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
      {result}
    </span>
  );
}

export function QcPanel({
  poId,
  inspections,
  canCreate,
  canEdit = false,
}: {
  poId: string;
  inspections: Inspection[];
  canCreate: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const colSpan = canEdit ? 6 : 4;

  return (
    <div className="rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">QC inspections</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Date</th>
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">AQL</th>
            <th className="px-3 py-1.5 font-semibold">Result</th>
            {canEdit && <th className="px-3 py-1.5 font-semibold">Remarks</th>}
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {inspections.length === 0 && (
            <tr><td colSpan={colSpan} className="px-3 py-4 text-center text-ink-soft">No inspections yet.</td></tr>
          )}
          {inspections.map((i) => (
            <tr key={i.id} className="border-b border-line last:border-0 align-top">
              <td className="px-3 py-1.5 tnum text-xs">
                {canEdit ? (
                  <EditableCell id={i.id} raw={isoDate(i.date)} type="date" action={setInspectionDate}>{fmt(i.date)}</EditableCell>
                ) : fmt(i.date)}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs">
                {canEdit ? (
                  <EditableCell id={i.id} raw={i.type} type="select" options={TYPE_OPTIONS} action={setInspectionType}>{i.type}</EditableCell>
                ) : i.type}
              </td>
              <td className="px-3 py-1.5 tnum text-xs">
                {canEdit ? (
                  <EditableCell id={i.id} raw={i.aql ?? ""} type="text" placeholder="—" action={setInspectionAql}>{i.aql ?? "—"}</EditableCell>
                ) : (i.aql ?? "—")}
              </td>
              <td className="px-3 py-1.5">
                {canEdit ? (
                  <EditableCell id={i.id} raw={i.result} type="select" options={RESULT_OPTIONS} action={setInspectionResult}>
                    <ResultBadge result={i.result} />
                  </EditableCell>
                ) : <ResultBadge result={i.result} />}
              </td>
              {canEdit && (
                <td className="px-3 py-1.5 text-xs">
                  <EditableCell id={i.id} raw={i.remarks ?? ""} type="text" placeholder="—" action={setInspectionRemarks}>{i.remarks ?? "—"}</EditableCell>
                </td>
              )}
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  <RowDeleteButton id={i.id} action={deleteInspectionAction} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canCreate && (
        <form
          action={async (fd) => {
            const res = await addInspectionAction(poId, fd);
            if (res.error) setMsg(res.error);
            else router.refresh();
          }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          <select name="type" required className="select text-xs" aria-label="Inspection type">
            <option value="INLINE">INLINE</option>
            <option value="FINAL">FINAL</option>
          </select>
          <select name="result" required className="select text-xs" aria-label="Inspection result">
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
          <input name="date" type="date" defaultValue={TODAY} required className="input text-xs" aria-label="Inspection date" />
          <input name="aql" placeholder="AQL e.g. 2.5" className="input text-xs w-24" />
          <input name="remarks" placeholder="Remarks" className="input text-xs" aria-label="Inspection remarks" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            Add inspection
          </button>
        </form>
      )}
    </div>
  );
}
