const SIZE: Record<"sm" | "base" | "lg", string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-2xl",
};

export function BrandMark({
  size = "base",
  tagline,
  className = "",
}: {
  size?: "sm" | "base" | "lg";
  tagline?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className={`${SIZE[size]} tracking-tight`}>
        <span className="brand-gradient font-mono font-bold">ABD</span>
        <span className="font-semibold"> Sourcing</span>
      </span>
      {tagline && <span className="mt-0.5 text-xs font-normal text-ink-soft">{tagline}</span>}
    </span>
  );
}

export function BrandBadge({ className = "h-11 w-11 text-xs" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-badge inline-flex items-center justify-center rounded-xl font-mono font-bold text-white ${className}`}
    >
      ABD
    </span>
  );
}
