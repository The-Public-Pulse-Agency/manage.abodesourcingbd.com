const STYLES: Record<string, string> = {
  DONE: "bg-ok-soft text-ok",
  ON_TRACK: "bg-ok-soft text-ok",
  DUE_SOON: "bg-warn-soft text-warn",
  OVERDUE: "bg-bad-soft text-bad",
  UNSCHEDULED: "bg-line text-ink-soft",
};

export function RagChip({ rag }: { rag: string }) {
  const cls = STYLES[rag] ?? "bg-line text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${cls}`}
    >
      {rag.replace(/_/g, " ")}
    </span>
  );
}
