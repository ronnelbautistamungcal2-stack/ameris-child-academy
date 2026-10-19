import { apiJson } from "@/lib/api";
import { lessonOptionLabel } from "@/lib/lessonScheduling";
import { useMemo, useState } from "react";

// Pieces of the Steps of Progression editor shared by the Curriculum pages.

export function GoalEditor({ lessonId, goals, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setAdding(true);
    setEditingId(null);
    setForm({ title: "", description: "" });
    setError("");
  }

  function openEdit(goal) {
    setAdding(false);
    setEditingId(goal.id);
    setForm({ title: goal.title || "", description: goal.description || "" });
    setError("");
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm({ title: "", description: "" });
    setError("");
  }

  async function saveGoal() {
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (adding) {
        await apiJson(`/api/v1/lessons/${encodeURIComponent(lessonId)}/goals`, {
          method: "POST",
          body: JSON.stringify({ title: form.title, description: form.description || null }),
        });
      } else {
        await apiJson(`/api/v1/lessons/${encodeURIComponent(lessonId)}/goals`, {
          method: "PUT",
          body: JSON.stringify({ goalId: editingId, title: form.title, description: form.description || null }),
        });
      }
      cancel();
      if (onUpdate) await onUpdate();
    } catch (e) {
      setError(e.message || "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(goalId) {
    if (!confirm("Delete this goal step? Progress records linked to it will be orphaned.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(lessonId)}/goals`, {
        method: "DELETE",
        body: JSON.stringify({ goalId }),
      });
      if (onUpdate) await onUpdate();
    } catch (e) {
      setError(e.message || "Failed to delete goal");
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Steps of Progression</div>
        {!adding && !editingId && (
          <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50" onClick={openAdd}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Step
          </button>
        )}
      </div>

      {error && <div className="mb-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
        <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
        {error}
      </div>}

      {goals.length === 0 && !adding && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-6">
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-gray-500">No steps defined</p>
            <p className="text-[11px] text-gray-400">Add steps to enable multi-step progression tracking</p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {goals.map((g, idx) => (
          <div key={g.id} className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 transition hover:bg-gray-100">
            {editingId === g.id ? (
              <div className="flex-1 space-y-2">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="Step"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="Testing question (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <div className="flex gap-2">
                  <button type="button" className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60" onClick={saveGoal} disabled={saving || !form.title.trim()}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="text-xs font-semibold text-gray-500 transition hover:text-gray-700" onClick={cancel}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                  {g.goalIndex ?? idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">{g.title}</div>
                  {g.description && <div className="mt-0.5 text-xs text-gray-500">{g.description}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEdit(g)}>Edit</button>
                  <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50" onClick={() => deleteGoal(g.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-2 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-sky-50/30 p-4 space-y-3">
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Step (e.g. Recognize 5 colors)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Testing question (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60" onClick={saveGoal} disabled={saving || !form.title.trim()}>
              {saving ? "Saving..." : `Add Step ${(goals.length || 0) + 1}`}
            </button>
            <button type="button" className="text-xs font-semibold text-gray-500 transition hover:text-gray-700" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FormField({ label, required, className, children }) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </div>
      {children}
    </label>
  );
}

// Centers carry thousands of steps, so linking one step to another is a
// type-to-search picker rather than a select. Steps in the same category sort first.

const STEP_PICKER_LIMIT = 30;

export function StepPicker({ label, lessons, value, onChange, excludeIds, categoryId }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value ? lessons.find((lesson) => lesson.id === value) : null;

  const { matches, total } = useMemo(() => {
    if (!open) return { matches: [], total: 0 };
    const q = query.trim().toLowerCase();
    const all = lessons
      .filter((lesson) => !excludeIds.includes(lesson.id))
      .filter((lesson) =>
        !q ||
        [lesson.title, lesson.reference, lesson.subCategory, lesson.category?.name]
          .some((field) => (field || "").toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const rank = (lesson) => (categoryId && lesson.categoryId === categoryId ? 0 : 1);
        return rank(a) - rank(b) || (a.title || "").localeCompare(b.title || "");
      });
    return { matches: all.slice(0, STEP_PICKER_LIMIT), total: all.length };
  }, [open, query, lessons, excludeIds, categoryId]);

  function pick(id) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="block">
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">{label}</div>
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold text-indigo-800">{lessonOptionLabel(selected)}</span>
          {selected.reference && <span className="shrink-0 font-mono text-[11px] text-indigo-500">{selected.reference}</span>}
          <button type="button" className="shrink-0 rounded-md px-1.5 text-xs font-semibold text-indigo-500 transition hover:bg-indigo-100 hover:text-indigo-700" onClick={() => onChange("")}>
            Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Search by step, ref ID, or subject..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {matches.length === 0 ? (
                <div className="px-4 py-2 text-xs text-gray-400">No matching steps</div>
              ) : (
                matches.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-indigo-50"
                    // mousedown, not click: the input's blur would close the list first.
                    onMouseDown={(e) => { e.preventDefault(); pick(lesson.id); }}
                  >
                    <span className="min-w-0 flex-1 truncate">{lessonOptionLabel(lesson)}</span>
                    {lesson.reference && <span className="shrink-0 font-mono text-[11px] text-gray-400">{lesson.reference}</span>}
                  </button>
                ))
              )}
              {total > matches.length && (
                <div className="border-t border-gray-100 px-4 py-1.5 text-[11px] text-gray-400">
                  Showing {matches.length} of {total}. Keep typing to narrow it down.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaPreview({ url }) {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) {
    return <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />;
  }
  if (/\.(mp4|webm|mov)/.test(lower)) {
    return (
      <video src={url} className="h-14 w-20 rounded-lg object-cover" preload="metadata" controls />
    );
  }
  if (/\.(mp3|wav|ogg|m4a)/.test(lower)) {
    return <audio src={url} className="h-8 w-32" controls preload="metadata" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center gap-1.5 px-2 text-xs text-indigo-600 hover:underline">
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {url.split("/").pop() || "Document"}
    </a>
  );
}
