import { useState } from "react";
import CurriculumTypePicker from "@/components/curriculum/CurriculumTypePicker";
import { curriculumTypeLabels } from "@/lib/curriculumTypes";

// Set Types on many lessons or steps at once (client 2026-11-10: the imported
// banks have no types ticked, and subscribers only see the types they pay for).
const ACTIONS = [
  { value: "add", label: "Add these types", help: "Each one keeps the types it already has." },
  { value: "set", label: "Replace their types", help: "Each one ends up with exactly these types." },
  { value: "remove", label: "Remove these types", help: "Takes these types off; other types stay." },
];

export default function BulkTypesDialog({ count, noun = "lessons", onApply, onClose }) {
  const [action, setAction] = useState("add");
  const [types, setTypes] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const verb = ACTIONS.find((a) => a.value === action);
  const typesText = curriculumTypeLabels(types) || "no type";
  const summary =
    action === "add"
      ? `Add ${typesText} to ${count.toLocaleString()} ${noun}`
      : action === "remove"
        ? `Remove ${typesText} from ${count.toLocaleString()} ${noun}`
        : `Set ${count.toLocaleString()} ${noun} to ${typesText}`;

  async function apply() {
    setSaving(true);
    setError("");
    try {
      await onApply(action, types);
    } catch (e) {
      setError(e.message || "Could not change the types");
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Set Types">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div>
          <h2 className="text-xl font-black text-[#0b2a5b] dark:text-blue-100">Set Types</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            For the {count.toLocaleString()} {noun} that match your current search and filters.
          </p>
        </div>
        <fieldset className="space-y-2">
          {ACTIONS.map((a) => (
            <label key={a.value} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input type="radio" name="bulk-type-action" checked={action === a.value} onChange={() => setAction(a.value)} className="mt-1" />
              <span>
                <span className="font-semibold">{a.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{a.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <div className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">Types</div>
          <CurriculumTypePicker value={types} onChange={setTypes} idPrefix="bulk-type" />
        </div>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {confirming ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            {summary}? This can't be undone in one step.
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-[#0b2a5b] dark:border-gray-600 dark:text-blue-100">
            Cancel
          </button>
          {confirming ? (
            <button type="button" onClick={apply} disabled={saving} className="rounded-lg bg-[#0b2a5b] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Saving..." : `Yes, ${verb.label.split(" ")[0]}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!count || (!types.length && action !== "set")}
              className="rounded-lg bg-[#0b2a5b] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
