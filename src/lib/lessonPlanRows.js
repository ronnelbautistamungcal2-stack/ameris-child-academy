// Lesson plan categories (rows) for a classroom, shared by the plan-rows
// API, the Lesson Planner and the teacher's Weekly Lesson Plan. A row keeps
// its rowIndex for life (cells point at it); `position` is display order.

export const DEFAULT_ROW_LABELS = [
  "Hymn",
  "Large Group 1",
  "Small Group 1",
  "Small Group 2",
  "Outdoor Time 1",
  "Transition Activity 1",
  "Transition Activity 2",
  "Large Group 2",
  "Small Group 3",
  "Small Group 4",
];

/** The name shown for a row: its own label, the default, or "Row N". */
export function rowLabel(row) {
  return row?.label || DEFAULT_ROW_LABELS[row?.rowIndex] || `Row ${(row?.rowIndex ?? 0) + 1}`;
}

export const DEFAULT_ROW_COUNT = 10;

export function buildActiveRows(dbRows) {
  const byIndex = Object.fromEntries(dbRows.map((r) => [r.rowIndex, r]));
  const maxDbIndex = dbRows.reduce((max, r) => Math.max(max, r.rowIndex), -1);
  const maxIndex = Math.max(DEFAULT_ROW_COUNT - 1, maxDbIndex);

  const result = [];
  for (let i = 0; i <= maxIndex; i += 1) {
    const dbRow = byIndex[i];
    if (dbRow) {
      if (dbRow.active) {
        result.push({
          id: dbRow.id,
          rowIndex: i,
          label: dbRow.label || "",
          position: Number.isInteger(dbRow.position) ? dbRow.position : i,
        });
      }
    } else if (i < DEFAULT_ROW_COUNT) {
      result.push({ id: null, rowIndex: i, label: "", position: i });
    }
  }
  // Rows keep their identity (rowIndex, which lesson-plan cells reference) even
  // when dragged to a new spot — only their display `position` changes.
  result.sort((a, b) => a.position - b.position || a.rowIndex - b.rowIndex);
  return result;
}
