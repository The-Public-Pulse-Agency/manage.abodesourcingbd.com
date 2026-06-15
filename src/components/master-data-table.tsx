export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
};

export function MasterDataTable<T extends { id: string }>({
  rows,
  columns,
  empty = "Nothing yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
            {columns.map((c, i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-ink-soft">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {columns.map((c, i) => (
                <td key={i} className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
