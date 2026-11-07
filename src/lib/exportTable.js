// Export a report table to Excel (.xlsx) in the browser (client request
// 2026-10-29: every admin / coach report can go to Excel or PDF; PDF is the
// browser's Print > Save as PDF on the print-friendly sheet).

/** sheets: [{ name, headers: [...], rows: [[...], ...] }] */
/**
 * sheets: [{ name, headers, rows }]; a sheet can instead give headerRows
 * (several heading rows) and merges ([{ s: { r, c }, e: { r, c } }]).
 */
export async function exportToExcel(filename, sheets) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const head = sheet.headerRows || [sheet.headers];
    const ws = XLSX.utils.aoa_to_sheet([...head, ...sheet.rows]);
    if (sheet.merges?.length) ws["!merges"] = sheet.merges;
    const width = Math.max(...head.map((h) => h.length));
    ws["!cols"] = Array.from({ length: width }, (_, i) => ({
      wch: Math.min(40, Math.max(...head.map((h) => String(h[i] ?? "").length), ...sheet.rows.map((r) => String(r[i] ?? "").length)) + 2),
    }));
    XLSX.utils.book_append_sheet(book, ws, String(sheet.name || "Report").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  }
  XLSX.writeFile(book, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/**
 * Reads a rendered <table> (headers from its last header row, then body rows)
 * so any report on screen can be exported without rebuilding its data.
 */
export function tableToSheet(table, name = "Report") {
  if (!table) return null;
  const headRows = [...table.querySelectorAll("thead tr")];
  const headCells = headRows.length ? [...headRows[headRows.length - 1].children] : [];
  const headers = headCells.map((c) => c.innerText.trim());
  const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((td) => {
      const input = td.querySelector("input, select");
      return (input ? input.value : td.innerText).trim();
    }),
  );
  return { name, headers, rows };
}

/** Export every table inside `root` (an element), one sheet each. */
export async function exportElementTables(root, filename, baseName = "Report") {
  const tables = root ? [...root.querySelectorAll("table")] : [];
  const sheets = tables.map((t, i) => tableToSheet(t, tables.length > 1 ? `${baseName} ${i + 1}` : baseName)).filter((s) => s && (s.headers.length || s.rows.length));
  if (!sheets.length) throw new Error("There is nothing to export yet");
  await exportToExcel(filename, sheets);
}
