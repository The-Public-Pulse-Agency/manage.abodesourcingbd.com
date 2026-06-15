export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded-sm bg-line" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-surface p-4">
            <div className="h-3 w-24 rounded-sm bg-line" />
            <div className="h-6 w-20 rounded-sm bg-line" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <div className="border-b border-line bg-paper px-4 py-3">
          <div className="h-4 w-40 rounded-sm bg-line" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded-sm bg-line" />
          ))}
        </div>
      </div>
    </div>
  );
}
