"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCertificateAction, removeCertificateAction } from "@/lib/masterdata/certificate-form-actions";

export type CertRow = { id: string; name: string; number: string | null; validUntil: string | null; validityState: "ok" | "expiring" | "expired" | "na" };

const VALID_CLS: Record<string, string> = {
  ok: "bg-ok-soft text-ok",
  expiring: "bg-warn-soft text-warn",
  expired: "bg-bad-soft text-bad",
  na: "bg-line text-ink-soft",
};

export function FactoryCertificates({ factoryId, certs, canEdit }: { factoryId: string; certs: CertRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Certificate</th>
            <th className="px-3 py-1.5 font-semibold">Number</th>
            <th className="px-3 py-1.5 font-semibold">Valid until</th>
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {certs.length === 0 && (
            <tr><td colSpan={canEdit ? 4 : 3} className="px-3 py-3 text-center text-ink-soft">No certificates recorded.</td></tr>
          )}
          {certs.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5 font-medium">{c.name}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{c.number ?? "—"}</td>
              <td className="px-3 py-1.5">
                <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold ${VALID_CLS[c.validityState]}`}>
                  {c.validUntil ?? "—"}{c.validityState === "expired" ? " · expired" : c.validityState === "expiring" ? " · expiring" : ""}
                </span>
              </td>
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={async () => { const r = await removeCertificateAction(c.id); if (r.error) setMsg(r.error); else router.refresh(); }} className="text-xs text-ink-soft hover:text-bad">Remove</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <form
          action={async (fd) => { const r = await addCertificateAction(factoryId, fd); if (r.error) setMsg(r.error); else { setMsg(null); router.refresh(); } }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          <input name="name" placeholder="Certificate (e.g. GOTS)" required className="input text-xs" aria-label="Certificate name" />
          <input name="number" placeholder="Number" className="input text-xs" aria-label="Certificate number" />
          <input name="validUntil" type="date" className="input text-xs" aria-label="Valid until" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add certificate</button>
          {msg && <span className="text-xs text-bad">{msg}</span>}
        </form>
      )}
    </div>
  );
}
