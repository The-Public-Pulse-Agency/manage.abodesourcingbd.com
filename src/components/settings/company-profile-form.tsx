"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyProfileAction } from "@/lib/company/form-actions";
import type { CompanyProfile } from "@/lib/company/profile";

const FIELDS: { name: keyof CompanyProfile; label: string; placeholder?: string }[] = [
  { name: "name", label: "Company name" },
  { name: "address", label: "Company address" },
  { name: "bankName", label: "Bank name" },
  { name: "bankAccountName", label: "Account name (beneficiary)" },
  { name: "bankAccountNo", label: "Account number" },
  { name: "bankSwift", label: "SWIFT / BIC", placeholder: "e.g. ABCDBDDH" },
  { name: "bankBranch", label: "Branch / bank address" },
];

export function CompanyProfileForm({ profile, canEdit }: { profile: CompanyProfile; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setBusy(true);
        const r = await updateCompanyProfileAction(fd);
        setBusy(false);
        if (r.error) setMsg(r.error);
        else { setMsg("Saved ✓"); router.refresh(); }
      }}
      className="grid grid-cols-1 gap-3 rounded-md border border-line bg-surface p-4 elevate sm:grid-cols-2"
    >
      {FIELDS.map((f) => (
        <label key={f.name} className="block text-xs">
          <span className="mb-1 block font-medium text-ink-soft">{f.label}</span>
          <input
            name={f.name}
            defaultValue={profile[f.name] ?? ""}
            placeholder={f.placeholder}
            required={f.name === "name"}
            disabled={!canEdit}
            className="input w-full text-sm disabled:opacity-60"
          />
        </label>
      ))}
      {canEdit && (
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : "Save banking details"}
          </button>
          {msg && <span className={`text-xs ${msg.startsWith("Saved") ? "text-ok" : "text-bad"}`}>{msg}</span>}
        </div>
      )}
    </form>
  );
}
