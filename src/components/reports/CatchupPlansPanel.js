function arr(v) {
  return Array.isArray(v) ? v : [];
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function recommendationFromStatus(status) {
  if (status === "FAILED") {
    return "Re-teach this lesson in smaller steps, then reassess within 2-3 sessions.";
  }
  if (status === "IN_PROGRESS") {
    return "Add guided practice and parent follow-up activities this week.";
  }
  return "Schedule focused practice sessions and monitor progress checkpoints.";
}

export default function CatchupPlansPanel({ progressRows, childName }) {
  const pending = arr(progressRows)
    .filter((row) => ["FAILED", "NOT_STARTED", "IN_PROGRESS"].includes(row?.status))
    .slice(0, 12)
    .map((row, index) => ({
      id: row.id || `catchup-${index}`,
      title: row.lesson?.title || `Goal ${row.goalIndex || 1}`,
      status: row.status || "NOT_STARTED",
      when: row.updatedAt || row.createdAt || null,
      recommendation: recommendationFromStatus(row.status),
    }));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-base font-extrabold text-gray-900">Catch-up Plans</h4>
      <p className="mt-1 text-sm text-gray-600">
        {childName ? `Auto-generated catch-up actions for ${childName}.` : "Auto-generated catch-up actions based on progress records."}
      </p>
      {pending.length ? (
        <div className="mt-3 space-y-2">
          {pending.map((item) => (
            <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
              <div className="mt-1 text-xs font-semibold text-amber-700">
                Status: {item.status} | Last update: {formatDate(item.when)}
              </div>
              <div className="mt-2 text-xs text-gray-700">{item.recommendation}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No catch-up plans needed right now.
        </div>
      )}
    </div>
  );
}
