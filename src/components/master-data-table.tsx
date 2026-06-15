export type Column<T> = { header: string; cell: (row: T) => React.ReactNode };

export function MasterDataTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) {
  return (
    <table className="w-full border bg-white text-sm">
      <thead className="bg-slate-100 text-left">
        <tr>
          {columns.map((c) => (
            <th key={c.header} className="p-2">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t">
            {columns.map((c) => (
              <td key={c.header} className="p-2">
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
