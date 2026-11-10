import { CURRICULUM_TYPES } from "@/lib/curriculumTypes";

/**
 * Pick one or more curriculum types (client 2026-11-07): Non-Denominational,
 * Non-Denominational Christian, Other. value: array of type values.
 */
export default function CurriculumTypePicker({ value = [], onChange, disabled = false, idPrefix = "type" }) {
  const selected = new Set(value);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Type">
      {CURRICULUM_TYPES.map((t) => (
        <label key={t.value} htmlFor={`${idPrefix}-${t.value}`} className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
          <input
            id={`${idPrefix}-${t.value}`}
            type="checkbox"
            disabled={disabled}
            checked={selected.has(t.value)}
            onChange={(e) =>
              onChange(CURRICULUM_TYPES.map((x) => x.value).filter((v) => (v === t.value ? e.target.checked : selected.has(v))))
            }
          />
          {t.label}
        </label>
      ))}
    </div>
  );
}
