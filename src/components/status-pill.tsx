const STYLES: Record<string, string> = {
  DRAFT: "bg-line text-ink-soft",
  CONFIRMED: "bg-accent-soft text-accent",
  IN_PRODUCTION: "bg-warn-soft text-warn",
  PARTLY_SHIPPED: "bg-warn-soft text-warn",
  SHIPPED: "bg-ok-soft text-ok",
  CLOSED: "bg-ok-soft text-ok",
  CANCELLED: "bg-bad-soft text-bad",
  ON_HOLD: "bg-bad-soft text-bad",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-line text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
