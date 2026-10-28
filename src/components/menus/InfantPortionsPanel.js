import { apiJson } from "@/lib/api";
import { COMPONENTS, getMeal } from "@/lib/menuPlan";
import { useEffect, useState } from "react";

// Kitchen Menu Planner - Infant Portions side panel (client 2026-10-23): the
// amount of each served component prepared for each infant in the row.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const TONE = {
  youngerInfants: { label: "Younger Infants (0–5 months)", text: "text-purple-700 dark:text-purple-300", box: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800" },
  olderInfants: { label: "Older Infants (6–12 months)", text: "text-blue-700 dark:text-blue-300", box: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" },
};

function longDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function InfantPortionsPanel({ centerId, date, meal, ageGroup, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [amounts, setAmounts] = useState({}); // childId -> component -> amount
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const tone = TONE[ageGroup];

  useEffect(() => {
    const qs = new URLSearchParams({ centerId, date, meal, ageGroup });
    apiJson(`/api/v1/menus/infant-portions?${qs}`)
      .then((res) => {
        setData(res);
        setAmounts(Object.fromEntries(res.infants.map((i) => [i.id, { ...i.portions }])));
      })
      .catch((e) => setError(e.message || "Failed to load infant portions"));
  }, [centerId, date, meal, ageGroup]);

  function addInfant(id) {
    const child = data.others.find((c) => c.id === id);
    if (!child) return;
    setData((d) => ({ ...d, infants: [...d.infants, { ...child, portions: {} }], others: d.others.filter((c) => c.id !== id) }));
    setAmounts((a) => ({ ...a, [id]: {} }));
    setAdding(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const portions = data.infants.flatMap((i) =>
        data.components.map((c) => ({ childId: i.id, component: c.key, amount: amounts[i.id]?.[c.key] || "" })),
      );
      await apiJson("/api/v1/menus/infant-portions", { method: "PUT", body: JSON.stringify({ centerId, date, meal, ageGroup, portions }) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the portions");
      setSaving(false);
    }
  }

  return (
    <div className="menu-no-print fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Infant Portions">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className={`text-2xl font-black ${NAVY}`}>Infant Portions</h2>
            <div className={`text-sm font-semibold ${NAVY}`}>{getMeal(meal)?.label} · {longDate(date)}</div>
            <div className={`text-sm font-semibold ${tone?.text}`}>{tone?.label}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {!data ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <div className={`overflow-hidden rounded-xl border ${tone?.box}`}>
                <div className={`px-3 py-2 text-sm font-bold ${NAVY}`}>Actual Menu for This Meal</div>
                <div className="space-y-1 bg-white px-3 py-2 text-sm dark:bg-gray-900">
                  {data.components.map((c) => (
                    <div key={c.key} className="flex justify-between gap-3">
                      <span className="text-gray-700 dark:text-gray-300">{COMPONENTS[c.key]}</span>
                      <span className={`font-semibold ${c.item ? NAVY : "text-gray-400"}`}>
                        {c.item || "Not entered"}
                        {c.item && !c.servedRecorded ? <span className="ml-1 text-[11px] font-normal text-gray-500">(planned)</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className={`text-sm font-bold ${NAVY}`}>Enter the amount served to each infant</div>
                <p className="text-xs text-gray-500">These amounts are the portions prepared in the kitchen and placed in each child&apos;s bowl/bottle.</p>
              </div>

              {data.infants.map((infant) => (
                <div key={infant.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`font-bold ${NAVY}`}>{infant.name}</span>
                    <span className={`text-xs font-semibold ${tone?.text}`}>{infant.months != null ? `${infant.months} months` : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {data.components.map((c) => (
                      <label key={c.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          {COMPONENTS[c.key]}
                          {c.item ? <span className="block text-xs text-gray-500">({c.item})</span> : null}
                        </span>
                        <input
                          value={amounts[infant.id]?.[c.key] || ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [infant.id]: { ...a[infant.id], [c.key]: e.target.value } }))}
                          placeholder={c.key === "breastMilkOrFormula" ? "e.g. 4 oz" : "e.g. 2 tbsp"}
                          maxLength={40}
                          aria-label={`${infant.name} ${COMPONENTS[c.key]}`}
                          className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {!data.infants.length ? <p className="text-sm text-gray-500">No infants in this age group that day. Use Add Another Infant to record one.</p> : null}

              {adding ? (
                <select autoFocus defaultValue="" onChange={(e) => addInfant(e.target.value)} aria-label="Add another infant" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800">
                  <option value="">Choose a child...</option>
                  {data.others.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.months != null ? ` (${c.months} months)` : ""}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={!data.others.length}
                  className={`w-full rounded-xl border-2 border-dashed px-3 py-3 text-sm font-bold disabled:opacity-40 ${tone?.box} ${tone?.text}`}
                >
                  + Add Another Infant
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button type="button" onClick={save} disabled={!data || saving} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Portions"}
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
        </div>
      </div>
    </div>
  );
}
