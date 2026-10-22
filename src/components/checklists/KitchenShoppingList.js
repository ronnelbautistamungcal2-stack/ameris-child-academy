import { apiJson } from "@/lib/api";
import { formatDayKey } from "@/lib/checklistTime";
import { useEffect, useState } from "react";

// Kitchen Staff checklist: next week's planned menu as a shopping list
// (catered meals left off). Ticks are a per-device convenience only.
export default function KitchenShoppingList({ centerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  const [marked, setMarked] = useState({});
  const storageKey = data ? `aca:kitchenShopping:${centerId}:${data.start}` : "";

  useEffect(() => {
    if (!centerId) return;
    setError("");
    apiJson(`/api/v1/menus/shopping-list?centerId=${encodeURIComponent(centerId)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the shopping list"));
  }, [centerId]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      setMarked(JSON.parse(window.localStorage.getItem(storageKey) || "{}"));
    } catch {
      setMarked({});
    }
  }, [storageKey]);

  function toggle(item) {
    const next = { ...marked, [item]: !marked[item] };
    setMarked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  const items = data?.items || [];
  const range = data ? `${formatDayKey(data.start, { month: "short", day: "numeric" })} – ${formatDayKey(data.end, { month: "short", day: "numeric" })}` : "Next Week";
  const markedCount = items.filter((row) => marked[row.item]).length;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white dark:border-emerald-900 dark:bg-gray-900">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <h3 className="text-sm font-extrabold text-[#0b2a5b] dark:text-blue-100">Supplies Needed for {range}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{markedCount}/{items.length} items marked</p>
        </div>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-2 dark:border-emerald-900">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
          {!data && !error ? <div className="py-2 text-xs text-gray-500">Loading…</div> : null}
          {data && !items.length ? (
            <div className="py-2 text-xs text-gray-500">Nothing is on next week&apos;s planned menu yet (catered meals are left off).</div>
          ) : null}
          {items.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-[#0b2a5b] dark:text-blue-100">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2">Meals Served For</th>
                  <th className="py-2 text-center">Times Served Next Week</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.item} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!marked[row.item]} onChange={() => toggle(row.item)} className="h-4 w-4 rounded border-gray-300" />
                        <span className={marked[row.item] ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-200"}>{row.item}</span>
                      </label>
                    </td>
                    <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-400">{row.meals.join(", ")}</td>
                    <td className="py-1.5 text-center font-semibold text-gray-800 dark:text-gray-200">{row.timesServed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
