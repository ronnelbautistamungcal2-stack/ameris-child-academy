import { useState } from "react";
import { apiJson } from "@/lib/api";

/**
 * Edits one section of the Child Profile page. Each section hands over its own
 * field list, and the save goes through the family-owned snapshot endpoint, so
 * only the keys shown here are touched.
 */
export default function ChildProfileEditDialog({ child, title, fields, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map(({ name }) => [name, child?.[name] || ""])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const snapshot = await apiJson(
        `/api/v1/children/${encodeURIComponent(child.id)}/snapshot`,
        { method: "PUT", body: JSON.stringify(form) },
      );
      onSaved?.(snapshot);
    } catch (e) {
      setError(e.message || "Failed to save the profile");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${title}`}
    >
      <form
        onSubmit={save}
        className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
              {title}
            </h2>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {child.firstName} {child.lastName || ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {fields.map(({ name, label, placeholder, rows = 2 }) => {
            const inputId = `child-profile-${name}`;
            return (
              <div key={name}>
                <label
                  htmlFor={inputId}
                  className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400"
                >
                  {label}
                </label>
                {rows > 1 ? (
                  <textarea
                    id={inputId}
                    rows={rows}
                    value={form[name]}
                    placeholder={placeholder}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [name]: event.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                  />
                ) : (
                  <input
                    id={inputId}
                    type="text"
                    value={form[name]}
                    placeholder={placeholder}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [name]: event.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
