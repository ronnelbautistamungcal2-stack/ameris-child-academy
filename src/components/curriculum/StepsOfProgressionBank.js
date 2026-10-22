import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { GoalEditor, MediaPreview, StepPicker } from "@/components/curriculum/stepParts";
import { apiJson } from "@/lib/api";
import {
  formatStepAge,
  normalizeStepTerm,
  readStepSheet,
  STEP_AGE_MONTH_OPTIONS,
  STEP_AGE_YEAR_OPTIONS,
  STEP_CRITERIA_LEVELS,
  STEP_IMPORT_COLUMNS,
} from "@/lib/progressionSteps";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

// Steps of Progression Bank (client mockups 2026-10-02): a sortable,
// filterable table of steps, the Add Step of Progression pop-up and an
// Excel/CSV import. A step is a Lesson row with isStep set, so Lesson Bank
// lessons never show here; Category, Subject and Age Range come from
// Curriculum > Categories. The goals editor stays available from each row.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const TERMS = ["Term 1", "Term 2", "Term 3", "Term 4", "Term 5"];
const PAGE_SIZES = [10, 25, 50];
const SUPPLY_CATEGORIES = ["General", "Art", "Science", "Craft", "Outdoor", "Music", "Math", "Other"];
const control =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const input = `w-full ${control}`;

const COLUMNS = [
  { key: "reference", label: "Ref ID" },
  { key: "title", label: "Step of Progression" },
  { key: "category", label: "Category" },
  { key: "subject", label: "Subject" },
  { key: "age", label: "Age Range" },
  { key: "term", label: "Term" },
];

function stepRow(lesson) {
  return {
    lesson,
    id: lesson.id,
    reference: lesson.reference || "",
    title: lesson.title || "",
    category: lesson.category?.name || "",
    subject: lesson.subCategory || "",
    age: lesson.category?.ageRange || formatStepAge(lesson) || "",
    term: lesson.term || "",
    ageSort: (lesson.ageYears ?? 99) * 12 + (lesson.ageMonths ?? 0),
  };
}

function distinct(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export default function StepsOfProgressionBank({ centerId }) {
  const [lessons, setLessons] = useState([]); // steps
  const [bankLessons, setBankLessons] = useState([]); // Lesson Bank, for Related Lesson
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState({ CATEGORY: [], SUBJECT: [], AGE_RANGE: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ category: "", subject: "", age: "", term: "" });
  const [sort, setSort] = useState({ key: "reference", dir: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState(null); // "new" | lesson
  const [goalsFor, setGoalsFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = encodeURIComponent(centerId);
      const [l, bank, cats, opts] = await Promise.all([
        apiJson(`/api/v1/lessons?centerId=${q}&kind=step`),
        apiJson(`/api/v1/lessons?centerId=${q}&kind=lesson`),
        apiJson(`/api/v1/lesson-categories?centerId=${q}`),
        apiJson(`/api/v1/curriculum-options?centerId=${q}`).catch(() => null),
      ]);
      setLessons(Array.isArray(l) ? l : []);
      setBankLessons(Array.isArray(bank) ? bank : []);
      setCategories(Array.isArray(cats) ? cats : []);
      if (opts) setOptions(opts);
    } catch (e) {
      setError(e.message || "Failed to load the steps");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => lessons.map(stepRow), [lessons]);
  const filterOptions = useMemo(
    () => ({
      category: distinct(rows.map((r) => r.category)),
      subject: distinct(rows.map((r) => r.subject)),
      age: distinct(rows.map((r) => r.age)),
      term: distinct(rows.map((r) => r.term)),
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!q || [r.reference, r.title, r.subject, r.category].some((v) => v.toLowerCase().includes(q))) &&
        Object.entries(filters).every(([key, value]) => !value || r[key] === value),
    );
    const sortKey = sort.key === "age" ? "ageSort" : sort.key;
    return list.sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return cmp * sort.dir;
    });
  }, [rows, query, filters, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * pageSize, current * pageSize);
  const filtered = query || Object.values(filters).some(Boolean);

  async function remove(lesson) {
    setDeleting(null);
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(lesson.id)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Could not delete the step");
    }
  }

  const filterSelect = (key, all) => (
    <select
      value={filters[key]}
      onChange={(e) => {
        setFilters({ ...filters, [key]: e.target.value });
        setPage(1);
      }}
      aria-label={all}
      className={`${control} min-w-[140px]`}
    >
      <option value="">{all}</option>
      {filterOptions[key].map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by step, ref ID, or subject..."
          aria-label="Search steps"
          className={`${control} min-w-[220px] flex-1`}
        />
        {filterSelect("category", "All Categories")}
        {filterSelect("subject", "All Subjects")}
        {filterSelect("age", "All Ages")}
        {filterSelect("term", "All Terms")}
        <button
          type="button"
          disabled={!filtered}
          onClick={() => {
            setQuery("");
            setFilters({ category: "", subject: "", age: "", term: "" });
          }}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-200"
        >
          Clear Filters
        </button>
        <button type="button" onClick={downloadStepTemplate} className="ml-auto rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-200">
          Download Template
        </button>
        <button type="button" onClick={() => setImporting(true)} className="rounded-lg border border-[#0b2a5b] bg-white px-3 py-2 text-sm font-bold text-[#0b2a5b] hover:bg-blue-50 dark:border-blue-300 dark:bg-gray-800 dark:text-blue-100">
          Import Steps
        </button>
        <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-[#0b2a5b] px-4 py-2 text-sm font-bold text-white hover:bg-[#123a78]">
          + Add Step
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className={`bg-blue-50 text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}
                    className="inline-flex items-center gap-1"
                    aria-label={`Sort by ${c.label}`}
                  >
                    {c.label}
                    <span aria-hidden className="text-[10px] text-gray-400">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Loading...</td>
              </tr>
            )}
            {!loading && !shown.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">{filtered ? "No steps match these filters." : "No steps yet."}</td>
              </tr>
            )}
            {shown.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-gray-100 text-blue-800 dark:border-gray-800 dark:text-blue-200">
                  <td className="px-3 py-1.5 font-mono text-xs">{r.reference || "—"}</td>
                  <td className="px-3 py-1.5">{r.title}</td>
                  <td className="px-3 py-1.5">{r.category || "—"}</td>
                  <td className="px-3 py-1.5">{r.subject || "—"}</td>
                  <td className="px-3 py-1.5">{r.age || "—"}</td>
                  <td className="px-3 py-1.5">{r.term || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-center">
                    <button type="button" onClick={() => setEditing(r.lesson)} title="Edit" aria-label={`Edit ${r.title}`} className="rounded px-1.5 text-[#0b2a5b] hover:bg-blue-50 dark:text-blue-200">
                      &#9998;
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoalsFor(goalsFor === r.id ? null : r.id)}
                      title="Goals"
                      aria-expanded={goalsFor === r.id}
                      aria-label={`Goals for ${r.title}`}
                      className="rounded px-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300"
                    >
                      Goals ({r.lesson.goals?.length || 0})
                    </button>
                    <button type="button" onClick={() => setDeleting(r.lesson)} title="Delete" aria-label={`Delete ${r.title}`} className="rounded px-1.5 text-red-600 hover:bg-red-50">
                      {"\u{1F5D1}"}
                    </button>
                  </td>
                </tr>
                {goalsFor === r.id && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
                      <GoalEditor lessonId={r.id} goals={r.lesson.goals || []} onUpdate={load} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#0b2a5b] dark:text-blue-100">
        <span>
          Showing {visible.length ? (current - 1) * pageSize + 1 : 0} to {Math.min(current * pageSize, visible.length)} of {visible.length} steps
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            Rows per page:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <Pager page={current} pages={pages} onPage={setPage} />
        </div>
      </div>

      {editing && (
        <StepDialog
          centerId={centerId}
          step={editing === "new" ? null : editing}
          lessons={lessons}
          bankLessons={bankLessons}
          categories={categories}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {importing && <ImportStepsDialog centerId={centerId} onClose={() => setImporting(false)} onImported={load} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this step?"
        message={deleting ? `Delete "${deleting.title}"? Its goals and the progress recorded against them are affected.` : ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const btn = "min-w-[32px] rounded-md border border-gray-300 px-2 py-1 disabled:opacity-30 dark:border-gray-600";
  return (
    <nav className="flex items-center gap-1" aria-label="Pages">
      <button type="button" className={btn} onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page">{"«"}</button>
      <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">{"‹"}</button>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${btn} ${n === page ? "border-[#0b2a5b] bg-[#0b2a5b] text-white" : ""}`}
        >
          {n}
        </button>
      ))}
      <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">{"›"}</button>
      <button type="button" className={btn} onClick={() => onPage(pages)} disabled={page >= pages} aria-label="Last page">{"»"}</button>
    </nav>
  );
}

function emptyForm(step) {
  return {
    reference: step?.reference || "",
    title: step?.title || "",
    category: step?.category?.name || "",
    subject: step?.subCategory || "",
    ageYears: step?.ageYears ?? "",
    ageMonths: step?.ageMonths ?? "",
    term: step?.term || "",
    linkedLessonId: step?.linkedLessonId || "",
    description: step?.description || "",
    criteria: Object.fromEntries(STEP_CRITERIA_LEVELS.map(({ key }) => [key, step?.criteria?.[key] || ""])),
    priorStepId: step?.priorStepId || "",
    nextStepId: step?.nextStepId || "",
    supplies: (step?.supplies || []).map((s) => ({ ...s, quantity: s.quantity ?? 1 })),
    media: step?.media || [],
    notes: step?.notes || "",
    type: step?.type || "",
  };
}

function withCurrent(list, value) {
  const names = list.map((o) => (typeof o === "string" ? o : o.name));
  return value && !names.includes(value) ? [value, ...names] : names;
}

function StepDialog({ centerId, step, lessons, bankLessons, categories, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => emptyForm(step));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const categoryNames = withCurrent(options.CATEGORY?.length ? options.CATEGORY : distinct(categories.map((c) => c.name)), form.category);
  const subjectNames = withCurrent(options.SUBJECT || [], form.subject);
  const termNames = withCurrent(TERMS, form.term);
  const typeNames = withCurrent(options.TYPE || [], form.type);
  const others = lessons.filter((l) => l.id !== step?.id);

  // A step's category is a LessonCategory row; reuse the one with that name
  // (the step's own first), or create it.
  async function categoryIdFor(name) {
    if (!name) return null;
    if (step?.category?.name === name) return step.category.id;
    const match = categories.find((c) => c.name === name && !c.ageRange) || categories.find((c) => c.name === name);
    if (match) return match.id;
    const created = await apiJson("/api/v1/lesson-categories", { method: "POST", body: JSON.stringify({ centerId, name }) });
    return created.id;
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Attachments can be up to 10 MB.");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await apiJson("/api/v1/upload", { method: "POST", body: JSON.stringify({ fileName: file.name, file: reader.result }) });
        set({ media: [...form.media, result.url] });
      } catch (err) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const missing = [
      ["Ref ID", form.reference],
      ["Step Description", form.title],
      ["Category", form.category],
      ["Subject", form.subject],
      ["Age (Years)", String(form.ageYears)],
      ["Age (Months)", String(form.ageMonths)],
      ["Term", form.term],
    ].filter(([, v]) => !String(v).trim());
    if (missing.length) return setError(`Fill in ${missing.map(([label]) => label).join(", ")}.`);
    setSaving(true);
    setError("");
    try {
      const payload = {
        reference: form.reference.trim(),
        title: form.title.trim(),
        categoryId: await categoryIdFor(form.category),
        subCategory: form.subject,
        ageYears: Number(form.ageYears),
        ageMonths: Number(form.ageMonths),
        term: form.term,
        linkedLessonId: form.linkedLessonId || null,
        description: form.description,
        criteria: form.criteria,
        priorStepId: form.priorStepId || null,
        nextStepId: form.nextStepId || null,
        supplies: form.supplies.filter((s) => String(s.name || "").trim()),
        media: form.media,
        notes: form.notes,
        type: form.type || null,
      };
      if (step) {
        await apiJson(`/api/v1/lessons/${encodeURIComponent(step.id)}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiJson("/api/v1/lessons", { method: "POST", body: JSON.stringify({ centerId, isStep: true, ...payload }) });
      }
      onSaved();
    } catch (e) {
      setError(e.message || "Could not save the step");
      setSaving(false);
    }
  }

  const label = `block text-sm font-bold ${NAVY}`;
  const req = <span className="text-red-600"> *</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="step-dialog-title">
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 id="step-dialog-title" className={`flex items-center gap-2 text-2xl font-black ${NAVY}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xl text-white" aria-hidden>+</span>
            {step ? "Edit Step of Progression" : "Add Step of Progression"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl text-[#0b2a5b] dark:text-blue-100">&times;</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className={`${label} md:col-span-4`}>
            Ref ID{req}
            <input value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="e.g. SP-001" className={`${input} mt-1`} />
          </label>
          <label className={`${label} md:col-span-8`}>
            Step Description{req}
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Enter a clear description of the developmental step..." className={`${input} mt-1`} />
          </label>
          <label className={`${label} md:col-span-4`}>
            Category{req}
            <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={`${input} mt-1`}>
              <option value="">Choose...</option>
              {categoryNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-4`}>
            Subject{req}
            <select value={form.subject} onChange={(e) => set({ subject: e.target.value })} className={`${input} mt-1`}>
              <option value="">Choose...</option>
              {subjectNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-2`}>
            Age (Years){req}
            <select value={form.ageYears} onChange={(e) => set({ ageYears: e.target.value })} className={`${input} mt-1`}>
              <option value="">{"—"}</option>
              {STEP_AGE_YEAR_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-2`}>
            Age (Months){req}
            <select value={form.ageMonths} onChange={(e) => set({ ageMonths: e.target.value })} className={`${input} mt-1`}>
              <option value="">{"—"}</option>
              {STEP_AGE_MONTH_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-3`}>
            Term{req}
            <select value={form.term} onChange={(e) => set({ term: e.target.value })} className={`${input} mt-1`}>
              <option value="">Choose...</option>
              {termNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={`${label} md:col-span-3`}>
            Type (Optional)
            <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={`${input} mt-1`}>
              <option value="">{"—"}</option>
              {typeNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="md:col-span-6">
            <StepPicker label="Related Lesson (Optional)" lessons={bankLessons} value={form.linkedLessonId} onChange={(id) => set({ linkedLessonId: id || "" })} excludeIds={[]} />
            <p className="mt-1 text-xs text-gray-500">Linking a lesson helps teachers see which lesson supports this step.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-blue-50/70 p-3 dark:bg-gray-800/60">
          <label className={label}>
            Assessment Question (Optional)
            <textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Enter a question to help assess if the child has mastered this step..." className={`${input} mt-1`} />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {STEP_CRITERIA_LEVELS.map(({ key, label: levelLabel }) => (
              <label key={key} className={label}>
                {levelLabel} (Optional)
                <input
                  value={form.criteria[key]}
                  onChange={(e) => set({ criteria: { ...form.criteria, [key]: e.target.value } })}
                  placeholder="type criteria"
                  className={`${input} mt-1`}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-blue-50/70 p-3 dark:bg-gray-800/60">
          <p className={`text-sm ${NAVY}`}>Link this step to other steps to show the typical order of development.</p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <StepPicker label="Builds On (Previous Step)" lessons={others} value={form.priorStepId} onChange={(id) => set({ priorStepId: id || "" })} excludeIds={[form.nextStepId].filter(Boolean)} />
            <StepPicker label="Leads To (Next Step)" lessons={others} value={form.nextStepId} onChange={(id) => set({ nextStepId: id || "" })} excludeIds={[form.priorStepId].filter(Boolean)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className={label}>Supplies (Optional)</div>
            <div className="mt-1 space-y-1.5">
              {form.supplies.map((s, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    value={s.name}
                    onChange={(e) => set({ supplies: form.supplies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                    placeholder="Supply"
                    aria-label="Supply name"
                    className={`${input} flex-1`}
                  />
                  <input
                    type="number"
                    min="1"
                    value={s.quantity}
                    onChange={(e) => set({ supplies: form.supplies.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 1 } : x)) })}
                    aria-label="Quantity"
                    className={`${input} w-20`}
                  />
                  <button type="button" onClick={() => set({ supplies: form.supplies.filter((_, j) => j !== i) })} aria-label="Remove supply" className="px-1 text-red-600">
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set({ supplies: [...form.supplies, { name: "", quantity: 1, quantityType: "total", category: SUPPLY_CATEGORIES[0] }] })}
                className="text-sm font-semibold text-blue-700 dark:text-blue-300"
              >
                + Add supply
              </button>
            </div>
          </div>
          <div>
            <div className={label}>Attachment (Optional)</div>
            <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 text-center text-sm text-[#0b2a5b] hover:bg-blue-50 dark:border-gray-600 dark:text-blue-100 dark:hover:bg-gray-800">
              <span className="font-semibold">{uploading ? "Uploading..." : "Click to upload a file"}</span>
              <span className="text-xs text-gray-500">PDF, Word, Excel, Images (Max 10 MB)</span>
              <input type="file" className="sr-only" onChange={upload} disabled={uploading} />
            </label>
            {form.media.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.media.map((url, i) => (
                  <div key={url + i} className="relative rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                    <MediaPreview url={url} />
                    <button type="button" onClick={() => set({ media: form.media.filter((_, j) => j !== i) })} aria-label="Remove attachment" className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-500 text-xs text-white">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <label className={`${label} mt-4`}>
          Additional Notes (Optional)
          <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Add any helpful notes, examples, or criteria..." className={`${input} mt-1`} />
        </label>

        {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-700 py-2.5 text-sm font-bold text-blue-800 dark:text-blue-200">Cancel</button>
          <button type="button" onClick={save} disabled={saving || uploading} className="rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Step"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function loadXlsx() {
  const mod = await import("xlsx");
  return mod.default || mod;
}

async function downloadStepTemplate() {
  const XLSX = await loadXlsx();
  const example = {
    reference: "SP-001",
    title: "Rolls from tummy to back",
    category: "Physical Development",
    subject: "Gross Motor",
    ageYears: 0,
    ageMonths: 4,
    term: "Term 1",
    description: "Can the child roll over without help?",
    exposure: "Rolls with help",
    competency: "Rolls on their own sometimes",
    mastery: "Rolls on their own every time",
    buildsOn: "",
    leadsTo: "SP-002",
    relatedLesson: "",
    type: "",
    notes: "",
  };
  const sheet = XLSX.utils.aoa_to_sheet([STEP_IMPORT_COLUMNS.map((c) => c.header), STEP_IMPORT_COLUMNS.map((c) => example[c.key])]);
  sheet["!cols"] = STEP_IMPORT_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Steps");
  XLSX.writeFile(book, "steps-of-progression-template.xlsx");
}

function ImportStepsDialog({ centerId, onClose, onImported }) {
  const [file, setFile] = useState(null); // { name, rows, missing }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function choose(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError("");
    setResult(null);
    try {
      const XLSX = await loadXlsx();
      const book = XLSX.read(await picked.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      setFile({ name: picked.name, ...readStepSheet(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" })) });
    } catch {
      setFile(null);
      setError("That file could not be read. Use an Excel (.xlsx, .xls) or CSV file.");
    }
  }

  async function runImport() {
    setBusy(true);
    setError("");
    try {
      const summary = await apiJson("/api/v1/lessons/import-steps", { method: "POST", body: JSON.stringify({ centerId, rows: file.rows }) });
      setResult(summary);
      setFile(null);
      await onImported();
    } catch (e) {
      setError(e.message || "The import failed");
    } finally {
      setBusy(false);
    }
  }

  const problems = result
    ? [...result.skipped.map((p) => ({ ...p, kind: "Skipped" })), ...result.warnings.map((p) => ({ ...p, kind: "Not linked" }))]
    : [];
  const preview = file?.rows.slice(0, 5) || [];
  const plural = (n) => `${n} step${n === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-steps-title">
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 id="import-steps-title" className={`text-2xl font-black ${NAVY}`}>Import Steps of Progression</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl text-[#0b2a5b] dark:text-blue-100">&times;</button>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Upload an Excel or CSV file with one step per row, using the template&apos;s columns. Only Ref ID and Step Description are required. A
          Ref ID that is already in the bank updates that step instead of adding a copy.{" "}
          <button type="button" onClick={downloadStepTemplate} className="font-semibold text-blue-700 underline dark:text-blue-300">
            Download the template
          </button>
        </p>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-3 py-5 text-center text-sm text-[#0b2a5b] hover:bg-blue-50 dark:border-gray-600 dark:text-blue-100 dark:hover:bg-gray-800">
          <span className="font-semibold">{file ? file.name : "Click to choose a file"}</span>
          <span className="text-xs text-gray-500">.xlsx, .xls or .csv</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={choose} disabled={busy} aria-label="Steps file" />
        </label>

        {file?.missing.length > 0 && (
          <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Couldn&apos;t find a {file.missing.join(" or ")} column. Check that the header row matches the template.
          </div>
        )}
        {file && !file.missing.length && (
          <div className="mt-3">
            <p className={`text-sm font-semibold ${NAVY}`}>
              {plural(file.rows.length)} found{file.rows.length > preview.length ? ` (first ${preview.length} shown)` : ""}.
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className={`bg-blue-50 font-bold dark:bg-gray-800 ${NAVY}`}>
                  <tr>
                    {["Ref ID", "Step Description", "Category", "Subject", "Age", "Term"].map((h) => (
                      <th key={h} className="px-2 py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.line} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1 font-mono">{r.reference || "—"}</td>
                      <td className="px-2 py-1">{r.title || "—"}</td>
                      <td className="px-2 py-1">{r.category || "—"}</td>
                      <td className="px-2 py-1">{r.subject || "—"}</td>
                      <td className="px-2 py-1">
                        {formatStepAge({ ageYears: r.ageYears === "" ? null : r.ageYears, ageMonths: r.ageMonths === "" ? null : r.ageMonths }) || "—"}
                      </td>
                      <td className="px-2 py-1">{normalizeStepTerm(r.term) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
            Import finished: {result.created} added, {result.updated} updated{result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.
          </div>
        )}
        {problems.length > 0 && (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            {problems.map((p, i) => (
              <li key={i}>
                Row {p.line}: {p.kind}. {p.reason}.
              </li>
            ))}
          </ul>
        )}
        {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-700 py-2.5 text-sm font-bold text-blue-800 dark:text-blue-200">
            {result ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={busy || !file || file.missing.length > 0 || !file.rows.length}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Importing..." : file?.rows.length ? `Import ${plural(file.rows.length)}` : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
