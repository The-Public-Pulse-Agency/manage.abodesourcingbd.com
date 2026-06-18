export default function Loading() {
  return (
    <>
      {/* Indeterminate top bar — animates while the route resolves. */}
      <div className="route-bar" aria-hidden />
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-7 w-56" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-md border border-line bg-surface p-4 elevate">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-6 w-20" />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
          <div className="border-b border-line bg-paper px-4 py-3">
            <div className="skeleton h-4 w-40" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-full" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
