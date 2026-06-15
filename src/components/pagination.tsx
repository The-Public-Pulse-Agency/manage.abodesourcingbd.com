import Link from "next/link";

/**
 * Server-rendered pagination. Preserves all current query params (filters) and only
 * swaps `page`. Renders nothing when there's a single page.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    q.set("page", String(p));
    return `?${q.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  // Compact window of page numbers around the current page.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-sm border border-line px-2 text-sm transition-colors hover:border-accent hover:text-accent";
  const active = "border-accent bg-accent-soft font-semibold text-accent";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-ink-soft">
        Showing <span className="tnum">{from}</span>–<span className="tnum">{to}</span> of{" "}
        <span className="tnum font-medium">{total}</span>
      </span>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Link href={href(prev)} className={`${btn} ${page === 1 ? disabled : ""}`} aria-label="Previous page">←</Link>
        {start > 1 && <span className="px-1 text-ink-soft">…</span>}
        {pages.map((p) => (
          <Link key={p} href={href(p)} className={`${btn} ${p === page ? active : ""}`} aria-current={p === page ? "page" : undefined}>
            {p}
          </Link>
        ))}
        {end < totalPages && <span className="px-1 text-ink-soft">…</span>}
        <Link href={href(next)} className={`${btn} ${page === totalPages ? disabled : ""}`} aria-label="Next page">→</Link>
      </nav>
    </div>
  );
}
