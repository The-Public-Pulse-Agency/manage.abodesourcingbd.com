"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentEntityType } from "@/lib/documents/documents";
import { createDocumentAction } from "@/lib/documents/form-actions";
import { uploadDocumentAction } from "@/lib/documents/upload-actions";

type Doc = { id: string; type: string; fileName: string; fileUrl: string | null; storageKey?: string | null; createdAt: string | Date };

const TYPES = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST", "TEST_CERT", "INSPECTION_REPORT", "SAMPLE_PHOTO", "OTHER"];

function fmt(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function DocumentsPanel({
  entityType,
  entityId,
  documents,
  canCreate,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  documents: Doc[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Documents</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">File</th>
            <th className="px-3 py-1.5 font-semibold">Added</th>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-4 text-center text-ink-soft">No documents yet.</td></tr>
          )}
          {documents.map((doc) => {
            // Always go through the tenant-gated proxy (streams private uploads, redirects
            // external links) — never link a raw blob URL.
            const hasFile = !!doc.storageKey || (!!doc.fileUrl && /^https?:\/\//i.test(doc.fileUrl));
            const safeHref = hasFile ? `/api/documents/${doc.id}/download` : undefined;
            return (
            <tr key={doc.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5 font-mono text-xs">{doc.type.replace(/_/g, " ")}</td>
              <td className="px-3 py-1.5">
                {safeHref ? (
                  <a href={safeHref} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                    {doc.fileName}
                  </a>
                ) : (
                  doc.fileName
                )}
              </td>
              <td className="px-3 py-1.5 tnum text-xs">{fmt(doc.createdAt)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {canCreate && (
        <>
          {/* Upload an actual file (PDF/image) — BL copy, invoice, inspection/test report, etc. */}
          <form
            action={async (fd) => {
              setMsg("Uploading…");
              const res = await uploadDocumentAction(entityType, entityId, fd);
              if (res.error) setMsg(res.error);
              else { setMsg(null); router.refresh(); }
            }}
            className="flex flex-wrap items-end gap-2 border-t border-line p-3"
          >
            <select name="type" required className="select text-xs" aria-label="Document type">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input name="file" type="file" required accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" className="text-xs" aria-label="File" />
            <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              Upload file
            </button>
          </form>
          {/* Or link to a file hosted elsewhere. */}
          <form
            action={async (fd) => {
              const res = await createDocumentAction(entityType, entityId, fd);
              if (res.error) setMsg(res.error);
              else { setMsg(null); router.refresh(); }
            }}
            className="flex flex-wrap items-end gap-2 border-t border-line px-3 py-2"
          >
            <select name="type" required className="select text-xs" aria-label="Document type (link)">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input name="fileName" placeholder="Label" required className="input text-xs" />
            <input name="fileUrl" placeholder="…or paste a URL" className="input text-xs" />
            <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-accent hover:text-accent">
              Add link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
