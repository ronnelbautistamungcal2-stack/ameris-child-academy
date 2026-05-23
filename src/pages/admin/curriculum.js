import AdminLayout from "@/components/admin/AdminLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatTermDaysLabel, normalizeTermDaySelections, TERM_DAY_OPTIONS } from "@/lib/lessonScheduling";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { key: "categories", label: "Categories", icon: TabIconCategories },
  { key: "lessons", label: "Steps of Progression", icon: TabIconLessons },
  { key: "remediations", label: "Remediations", icon: TabIconRemediations },
];

export default function CurriculumManager() {
  const [tab, setTab] = useState("categories");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminLayout title="Steps of Progression Manager">
      <div className="space-y-5">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-100/40 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-100/40 blur-2xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Steps of Progression Manager</h2>
                <p className="text-sm text-gray-500">Manage categories, steps of progression, and corrective learning paths</p>
              </div>
            </div>

            <label className="block w-full md:w-64">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Center</div>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm font-medium text-gray-800 shadow-sm transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select a center...</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </label>
          </div>

          {error && (
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {centerId && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-100/80 p-1.5 shadow-sm">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/60"
                        : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
                    }`}
                    onClick={() => setTab(t.key)}
                  >
                    <Icon active={active} />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {tab === "categories" && <CategoriesTab centerId={centerId} />}
            {tab === "lessons" && <LessonsTab centerId={centerId} />}
            {tab === "remediations" && <RemediationsTab centerId={centerId} />}
          </>
        )}

        {!centerId && !loading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-500">Select a center to manage curriculum</p>
            <p className="mt-1 text-xs text-gray-400">Choose a center from the dropdown above to get started</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

/* ── Tab Icons ───────────────────────────────────────── */

function TabIconCategories({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-indigo-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function TabIconLessons({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-indigo-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function TabIconRemediations({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-indigo-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

/* ── Categories Tab ──────────────────────────────────── */

function CategoriesTab({ centerId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", ageRange: "", kind: "PACKAGE" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson(`/api/v1/lesson-categories?centerId=${encodeURIComponent(centerId)}`);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [centerId]);

  function openCreate() {
    setEditing("new");
    setForm({ name: "", description: "", ageRange: "", kind: "PACKAGE" });
  }

  function openEdit(cat) {
    setEditing(cat.id);
    setForm({
      name: cat.name || "",
      description: cat.description || "",
      ageRange: cat.ageRange || "",
      kind: cat.kind || "PACKAGE",
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        await apiJson("/api/v1/lesson-categories", {
          method: "POST",
          body: JSON.stringify({ centerId, ...form }),
        });
      } else {
        await apiJson(`/api/v1/lesson-categories/${encodeURIComponent(editing)}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Delete this category?")) return;
    try {
      await apiJson(`/api/v1/lesson-categories/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  const totalLessons = categories.reduce(
    (sum, c) => sum + (c.lessonCount ?? c._count?.lessons ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Categories" value={loading ? "..." : categories.length} color="indigo" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        } />
        <StatCard label="Total Lessons" value={loading ? "..." : totalLessons} color="sky" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        } />
        <StatCard label="With Age Ranges" value={loading ? "..." : categories.filter(c => c.ageRange).length} color="emerald" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        } />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Lesson Categories
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow active:scale-[0.98]"
            onClick={openCreate}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Category
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Edit / Create form */}
          {editing && (
            <div className="mb-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-sky-50/30 p-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs text-white ${editing === "new" ? "bg-indigo-500" : "bg-amber-500"}`}>
                  {editing === "new" ? "+" : "E"}
                </span>
                {editing === "new" ? "New Category" : "Edit Category"}
              </h4>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Name" required>
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Language Arts" />
                </FormField>
                <FormField label="Age Range">
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. 0-2, 3-5" value={form.ageRange} onChange={(e) => setForm({ ...form, ageRange: e.target.value })} />
                </FormField>
                <FormField label="Description" className="md:col-span-2">
                  <textarea className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this category..." />
                </FormField>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60" onClick={save} disabled={saving || !form.name.trim()}>
                  {saving ? "Saving..." : editing === "new" ? "Create Category" : "Update Category"}
                </button>
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <Skeleton count={4} />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
              title="No categories yet"
              description="Create your first category to start organizing lessons"
              action={<button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700" onClick={openCreate}>Create First Category</button>}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Category</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Age Range</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">Lessons</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="transition hover:bg-gray-50/60">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-600">
                            {(cat.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">{cat.name}</div>
                            {cat.description && <div className="mt-0.5 truncate text-xs text-gray-500">{cat.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {cat.ageRange ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {cat.ageRange}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                          {cat.lessonCount ?? cat._count?.lessons ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEdit(cat)}>Edit</button>
                          <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50" onClick={() => deleteCategory(cat.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Lessons & Goals Tab ─────────────────────────────── */

function lessonCategoryLabel(category) {
  if (!category) return "Uncategorized";
  return category.ageRange ? `${category.name} (${category.ageRange})` : category.name;
}

function toggleTermDaySelection(days, dayValue) {
  const set = new Set(normalizeTermDaySelections(days));
  if (set.has(dayValue)) set.delete(dayValue);
  else set.add(dayValue);
  return [...set].sort((left, right) => left - right);
}

function LessonsTab({ centerId }) {
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    subCategory: "",
    term: "",
    termDays: [],
    lessonSlot: "",
    reference: "",
    linkedLessonId: "",
    media: [],
  });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [formAgeRange, setFormAgeRange] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [l, cats, pols] = await Promise.all([
        apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lesson-categories?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/policies?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
      ]);
      setLessons(Array.isArray(l) ? l : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setPolicies(Array.isArray(pols) ? pols : []);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [centerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((l) => {
      if (categoryFilter && (l.category?.id || "") !== categoryFilter) return false;
      if (ageFilter && (l.category?.ageRange || "") !== ageFilter) return false;
      if (termFilter && (l.term || "") !== termFilter) return false;
      if (!q) return true;
      return (
        (l.title || "").toLowerCase().includes(q) ||
        (l.term || "").toLowerCase().includes(q) ||
        (l.lessonSlot || "").toLowerCase().includes(q) ||
        (l.subCategory || "").toLowerCase().includes(q) ||
        (l.reference || "").toLowerCase().includes(q) ||
        (l.category?.name || "").toLowerCase().includes(q) ||
        (l.category?.ageRange || "").toLowerCase().includes(q)
      );
    });
  }, [lessons, ageFilter, categoryFilter, query, termFilter]);

  const ageOptions = useMemo(() => {
    return Array.from(new Set(categories.map((cat) => cat.ageRange || "").filter(Boolean))).sort();
  }, [categories]);

  const termOptions = useMemo(() => {
    return Array.from(new Set(lessons.map((lesson) => lesson.term || "").filter(Boolean))).sort();
  }, [lessons]);

  const formCategoryOptions = useMemo(() => {
    if (!formAgeRange) return categories;
    return categories.filter((cat) => (cat.ageRange || "") === formAgeRange);
  }, [categories, formAgeRange]);

  const categoryFilterOptions = useMemo(() => {
    if (!ageFilter) return categories;
    return categories.filter((cat) => (cat.ageRange || "") === ageFilter);
  }, [categories, ageFilter]);

  function openCreate() {
    setEditing("new");
    setForm({
      title: "",
      description: "",
      categoryId: "",
      subCategory: "",
      term: "",
      termDays: [],
      lessonSlot: "",
      reference: "",
      linkedLessonId: "",
      media: [],
    });
    setFormAgeRange(ageFilter || "");
  }

  function openEdit(lesson) {
    setEditing(lesson.id);
    setForm({
      title: lesson.title || "",
      description: lesson.description || "",
      categoryId: lesson.categoryId || "",
      subCategory: lesson.subCategory || "",
      term: lesson.term || "",
      termDays: normalizeTermDaySelections(lesson.termDays),
      lessonSlot: lesson.lessonSlot || "",
      reference: lesson.reference || "",
      linkedLessonId: lesson.linkedLessonId || "",
      media: lesson.media || [],
    });
    setFormAgeRange(lesson.category?.ageRange || "");
  }

  function handleAgeFilterChange(nextAgeRange) {
    setAgeFilter(nextAgeRange);
    setCategoryFilter((prev) => {
      if (!prev) return prev;
      const selectedCategory = categories.find((cat) => cat.id === prev);
      if (!selectedCategory) return "";
      return !nextAgeRange || (selectedCategory.ageRange || "") === nextAgeRange
        ? prev
        : "";
    });
  }

  function handleFormAgeRangeChange(nextAgeRange) {
    setFormAgeRange(nextAgeRange);
    setForm((prev) => {
      if (!prev.categoryId) return prev;
      const selectedCategory = categories.find((cat) => cat.id === prev.categoryId);
      if (!selectedCategory) return { ...prev, categoryId: "" };
      return (selectedCategory.ageRange || "") === nextAgeRange
        ? prev
        : { ...prev, categoryId: "" };
    });
  }

  function handleFormCategoryChange(nextCategoryId) {
    setForm((prev) => ({ ...prev, categoryId: nextCategoryId }));
    const selectedCategory = categories.find((cat) => cat.id === nextCategoryId);
    if (selectedCategory?.ageRange) {
      setFormAgeRange(selectedCategory.ageRange);
    }
  }

  async function save() {
    const selectedCategory = form.categoryId
      ? categories.find((cat) => cat.id === form.categoryId)
      : null;

    if (formAgeRange && !form.categoryId) {
      setError("Select a category for the chosen age group, or clear the age group.");
      return;
    }

    if (form.categoryId && !selectedCategory) {
      setError("Selected category could not be found. Reload and try again.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        subCategory: form.subCategory || null,
        term: form.term || null,
        termDays: normalizeTermDaySelections(form.termDays),
        lessonSlot: form.lessonSlot || null,
        reference: form.reference || null,
        media: form.media,
        categoryId: form.categoryId || null,
        linkedLessonId: form.linkedLessonId || null,
      };

      if (editing === "new") {
        await apiJson("/api/v1/lessons", {
          method: "POST",
          body: JSON.stringify({ centerId, ...payload }),
        });
      } else {
        await apiJson(`/api/v1/lessons/${encodeURIComponent(editing)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      setFormAgeRange("");
      await load();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(id) {
    if (!confirm("Delete this lesson? All associated goals and progress records will be affected.")) return;
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  async function handleMediaUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await apiJson("/api/v1/upload", {
          method: "POST",
          body: JSON.stringify({ fileName: file.name, file: reader.result }),
        });
        setForm((prev) => ({ ...prev, media: [...prev.media, result.url] }));
      } catch (err) {
        setError(err.message || "Upload failed");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removeMedia(idx) {
    setForm((prev) => ({ ...prev, media: prev.media.filter((_, i) => i !== idx) }));
  }

  const totalGoals = lessons.reduce((sum, l) => sum + (l.goals?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Steps" value={loading ? "..." : lessons.length} color="indigo" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        } />
        <StatCard label="Total Steps" value={loading ? "..." : totalGoals} color="emerald" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        } />
        <StatCard label="Categories" value={loading ? "..." : categories.length} color="sky" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
        } />
        <StatCard label="With Media" value={loading ? "..." : lessons.filter(l => l.media?.length > 0).length} color="amber" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
        } />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Steps of Progression
            {!loading && (
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                {filtered.length}{filtered.length !== lessons.length ? ` / ${lessons.length}` : ""}
              </span>
            )}
          </h3>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow active:scale-[0.98]" onClick={openCreate}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Step
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Edit / Create form */}
          {editing && (
            <div className="mb-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-sky-50/30 p-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs text-white ${editing === "new" ? "bg-indigo-500" : "bg-amber-500"}`}>
                  {editing === "new" ? "+" : "E"}
                </span>
                {editing === "new" ? "New Step" : "Edit Step"}
              </h4>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Step" required>
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Counting to 10" />
                </FormField>
                <FormField label="Age Group">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={formAgeRange} onChange={(e) => handleFormAgeRangeChange(e.target.value)}>
                    <option value="">No age group selected</option>
                    {ageOptions.map((age) => <option key={age} value={age}>{age}</option>)}
                  </select>
                </FormField>
                <FormField label="Category">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.categoryId} onChange={(e) => handleFormCategoryChange(e.target.value)}>
                    <option value="">None</option>
                    {formCategoryOptions.map((c) => <option key={c.id} value={c.id}>{lessonCategoryLabel(c)}</option>)}
                  </select>
                  {formAgeRange && formCategoryOptions.length === 0 && (
                    <div className="mt-1 text-xs font-medium text-amber-700">
                      No categories exist for {formAgeRange} yet. Create one in the Categories tab first.
                    </div>
                  )}
                  {!formAgeRange && ageOptions.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Pick an age group first when category names repeat across ages.
                    </div>
                  )}
                </FormField>
                <FormField label="Sub Category">
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} placeholder="Optional sub category" />
                </FormField>
                <FormField label="Term">
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Term 1" />
                </FormField>
                <FormField label="Lesson Slot">
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.lessonSlot} onChange={(e) => setForm({ ...form, lessonSlot: e.target.value })} placeholder="e.g. Large Group 1" />
                </FormField>
                <FormField label="Reference">
                  <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Reference code" />
                </FormField>
                <FormField label="Linked Lesson">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={form.linkedLessonId} onChange={(e) => setForm({ ...form, linkedLessonId: e.target.value })}>
                    <option value="">None</option>
                    {lessons.filter((lesson) => lesson.id !== editing).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
                  </select>
                </FormField>
                <FormField label="Term Days" className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {TERM_DAY_OPTIONS.map((option) => {
                      const active = normalizeTermDaySelections(form.termDays).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              termDays: toggleTermDaySelection(prev.termDays, option.value),
                            }))
                          }
                          className={[
                            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                            active
                              ? "bg-indigo-600 text-white"
                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Select every day in the term when this lesson should be pulled automatically.
                  </div>
                </FormField>
                <FormField label="Testing Question" className="md:col-span-2">
                  <textarea className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Testing question..." />
                </FormField>
              </div>

              {/* Media */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Attachments</div>
                <div className="flex flex-wrap gap-3">
                  {form.media.map((url, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:shadow-md">
                      <MediaPreview url={url} />
                      <button type="button" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white opacity-0 shadow transition group-hover:opacity-100" onClick={() => removeMedia(i)}>
                        x
                      </button>
                    </div>
                  ))}
                  <label className="flex h-16 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-400 transition hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-500">
                    <div className="text-center">
                      <svg className="mx-auto h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      <span className="mt-0.5 block text-[10px]">Add File</span>
                    </div>
                    <input type="file" className="hidden" accept="video/*,audio/*,image/*,.pdf,.doc,.docx" onChange={handleMediaUpload} />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60" onClick={save} disabled={saving || !form.title.trim()}>
                  {saving ? "Saving..." : editing === "new" ? "Create Step" : "Update Step"}
                </button>
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-2.5 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Search step..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="relative md:w-44">
              <select className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                <option value="">All terms</option>
                {termOptions.map((termOption) => <option key={termOption} value={termOption}>{termOption}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="relative md:w-48">
              <select className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" value={ageFilter} onChange={(e) => handleAgeFilterChange(e.target.value)}>
                <option value="">All ages</option>
                {ageOptions.map((age) => <option key={age} value={age}>{age}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="relative md:w-56">
              <select className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {categoryFilterOptions.map((c) => <option key={c.id} value={c.id}>{lessonCategoryLabel(c)}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Lessons list */}
          {loading ? (
            <Skeleton count={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
              title={query || categoryFilter || ageFilter || termFilter ? "No steps match your filters" : "No steps yet"}
              description={query || categoryFilter || ageFilter || termFilter ? "Try adjusting your search, category, age, or term filter" : "Create your first step to build your curriculum"}
              action={!query && !categoryFilter && !ageFilter && !termFilter ? <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700" onClick={openCreate}>Create First Step</button> : null}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((lesson) => (
                <div key={lesson.id} className="group rounded-2xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-600">
                          {(lesson.title || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">{lesson.title}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {lesson.category?.name && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                            {lesson.category.name}
                          </span>
                        )}
                        {lesson.category?.ageRange && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                            {lesson.category.ageRange}
                          </span>
                        )}
                        {lesson.term && (
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                            {lesson.term}
                          </span>
                        )}
                        {lesson.lessonSlot && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                            Slot: {lesson.lessonSlot}
                          </span>
                        )}
                        {normalizeTermDaySelections(lesson.termDays).length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            {formatTermDaysLabel(lesson.termDays)}
                          </span>
                        )}
                        {lesson.subCategory && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            {lesson.subCategory}
                          </span>
                        )}
                        {lesson.reference && (
                          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                            {lesson.reference}
                          </span>
                        )}
                        {lesson.linkedLesson && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                            Linked: {lesson.linkedLesson.title}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {lesson.goals?.length || 0} step{(lesson.goals?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        {lesson.media?.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            {lesson.media.length}
                          </span>
                        )}
                        {(lesson.remediationsFrom?.length || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            {lesson.remediationsFrom.length} remediation{lesson.remediationsFrom.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50" onClick={() => openEdit(lesson)}>Edit</button>
                      <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50" onClick={() => deleteLesson(lesson.id)}>Delete</button>
                      <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100" onClick={() => setExpanded((p) => ({ ...p, [lesson.id]: !p[lesson.id] }))}>
                        <svg className={`h-4 w-4 transition-transform ${expanded[lesson.id] ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded[lesson.id] && (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      {lesson.description && (
                        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{lesson.description}</p>
                      )}

                      {/* Goals */}
                      <GoalEditor lessonId={lesson.id} goals={lesson.goals || []} onUpdate={load} />

                      {/* Media */}
                      {lesson.media?.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Attachments</div>
                          <div className="flex flex-wrap gap-3">
                            {lesson.media.map((url, i) => (
                              <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
                                <MediaPreview url={url} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Remediations Tab ────────────────────────────────── */

function RemediationsTab({ centerId }) {
  const [remediations, setRemediations] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([
        apiJson(`/api/v1/remediations?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setRemediations(Array.isArray(r) ? r : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [centerId]);

  async function addLink() {
    if (!fromId || !toId) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(fromId)}/remediations`, {
        method: "POST",
        body: JSON.stringify({ toLessonId: toId, reason: reason || null }),
      });
      setAdding(false);
      setFromId("");
      setToId("");
      setReason("");
      await load();
    } catch (e) {
      setError(e.message || "Failed to add remediation");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(fromLessonId, id) {
    if (!confirm("Remove this remediation link?")) return;
    try {
      await apiJson(`/api/v1/lessons/${encodeURIComponent(fromLessonId)}/remediations`, {
        method: "DELETE",
        body: JSON.stringify({ remediationId: id }),
      });
      await load();
    } catch (e) {
      setError(e.message || "Failed to remove");
    }
  }

  async function handleAutoGeneratePreview() {
    setAutoGenerating(true);
    setError("");
    setPreview(null);
    setCommitResult(null);
    try {
      const result = await apiJson("/api/v1/remediations/auto-generate", {
        method: "POST",
        body: JSON.stringify({ centerId, dryRun: true }),
      });
      setPreview(result);
    } catch (e) {
      setError(e.message || "Failed to preview auto-generation");
    } finally {
      setAutoGenerating(false);
    }
  }

  async function handleAutoGenerateCommit() {
    setCommitting(true);
    setError("");
    try {
      const result = await apiJson("/api/v1/remediations/auto-generate", {
        method: "POST",
        body: JSON.stringify({ centerId, dryRun: false }),
      });
      setCommitResult(result);
      setPreview(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to auto-generate remediations");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Remediation Links" value={loading ? "..." : remediations.length} color="orange" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        } />
        <StatCard label="Lessons" value={loading ? "..." : lessons.length} color="indigo" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        } />
        <StatCard label="Coverage" value={loading ? "..." : lessons.length > 0 ? `${Math.round((new Set(remediations.map(r => r.fromLessonId)).size / lessons.length) * 100)}%` : "0%"} color="emerald" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        } />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Corrective Learning Paths
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-60"
              onClick={handleAutoGeneratePreview}
              disabled={autoGenerating}
            >
              <svg className={`h-3.5 w-3.5 ${autoGenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {autoGenerating ? "Analyzing..." : "Auto-Generate"}
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow active:scale-[0.98]" onClick={() => setAdding(true)}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Link
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Auto-generate commit result */}
          {commitResult && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-emerald-900">Auto-Generation Complete</h4>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                  {commitResult.commitResult.created} created
                </span>
                {commitResult.commitResult.updated > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm">
                    {commitResult.commitResult.updated} updated
                  </span>
                )}
                {commitResult.commitResult.errors?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm">
                    {commitResult.commitResult.errors.length} errors
                  </span>
                )}
              </div>
              <button type="button" className="mt-3 text-xs font-semibold text-gray-500 transition hover:text-gray-700" onClick={() => setCommitResult(null)}>
                Dismiss
              </button>
            </div>
          )}

          {/* Auto-generate preview */}
          {preview && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-sky-50/30 p-5 space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </h4>

              <div className="flex flex-wrap gap-2">
                <MiniStatBadge label="Lessons analyzed" value={preview.stats.totalLessons} color="gray" />
                <MiniStatBadge label="Groups" value={preview.stats.bucketsFound} color="gray" />
                <MiniStatBadge label="New links" value={preview.stats.proposalsGenerated} color="emerald" />
                {preview.stats.skippedExisting > 0 && (
                  <MiniStatBadge label="Already exist" value={preview.stats.skippedExisting} color="amber" />
                )}
                {preview.stats.goalsWithoutRef > 0 && (
                  <MiniStatBadge label="No reference" value={preview.stats.goalsWithoutRef} color="gray" />
                )}
              </div>

              {preview.proposals.length > 0 ? (
                <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
                  {preview.proposals.slice(0, 50).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2.5 text-xs transition hover:bg-gray-100">
                      <span className="max-w-[180px] truncate rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                        {p.fromLessonTitle}
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="max-w-[180px] truncate rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                        {p.toLessonTitle}
                      </span>
                      <span className="ml-auto whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{p.age} / {p.subjectCode}</span>
                    </div>
                  ))}
                  {preview.proposals.length > 50 && (
                    <div className="py-2 text-center text-xs text-gray-500">
                      ... and {preview.proposals.length - 50} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-white p-4 text-center text-sm text-gray-500">
                  All sequential links already exist. Nothing new to generate.
                </div>
              )}

              <div className="flex gap-2">
                {preview.proposals.length > 0 && (
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                    onClick={handleAutoGenerateCommit}
                    disabled={committing}
                  >
                    {committing ? "Creating..." : `Create ${preview.proposals.length} Links`}
                  </button>
                )}
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add link form */}
          {adding && (
            <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-sky-50/30 p-5 space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500 text-xs text-white">+</span>
                New Remediation Link
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="When this lesson fails">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                    <option value="">Select lesson...</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </FormField>
                <FormField label="Recommend this corrective lesson">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={toId} onChange={(e) => setToId(e.target.value)}>
                    <option value="">Select lesson...</option>
                    {lessons.filter((l) => l.id !== fromId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Reason (optional)">
                <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this remediation is recommended..." />
              </FormField>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60" onClick={addLink} disabled={saving || !fromId || !toId}>
                  {saving ? "Saving..." : "Create Link"}
                </button>
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Remediation links list */}
          {loading ? (
            <Skeleton count={4} />
          ) : remediations.length === 0 ? (
            <EmptyState
              icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
              title="No remediation links yet"
              description="Create links between lessons to define corrective learning paths, or auto-generate them from your curriculum"
              action={
                <div className="flex gap-2">
                  <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100" onClick={handleAutoGeneratePreview} disabled={autoGenerating}>Auto-Generate</button>
                  <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700" onClick={() => setAdding(true)}>Add Manually</button>
                </div>
              }
            />
          ) : (
            <div className="space-y-2">
              {remediations.map((r) => (
                <div key={r.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                      <svg className="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r.fromLesson?.title || "?"}
                    </span>
                    <svg className="h-5 w-5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r.toLesson?.title || "?"}
                    </span>
                    {r.reason && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{r.reason}</span>
                    )}
                  </div>
                  <button type="button" className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 opacity-0 transition hover:bg-red-50 group-hover:opacity-100" onClick={() => removeLink(r.fromLessonId, r.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Goal Editor ────────────────────────────────────── */

function GoalEditor({ lessonId, goals, onUpdate }) {
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

/* ── Shared Components ──────────────────────────────── */

function StatCard({ label, value, color, icon }) {
  const colors = {
    indigo: "from-indigo-50 to-indigo-100/50 text-indigo-600 border-indigo-200/60",
    sky: "from-sky-50 to-sky-100/50 text-sky-600 border-sky-200/60",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200/60",
    amber: "from-amber-50 to-amber-100/50 text-amber-600 border-amber-200/60",
    orange: "from-orange-50 to-orange-100/50 text-orange-600 border-orange-200/60",
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-60">{label}</div>
          <div className="mt-1 text-2xl font-extrabold">{value}</div>
        </div>
        <div className="opacity-40">{icon}</div>
      </div>
    </div>
  );
}

function MiniStatBadge({ label, value, color }) {
  const colors = {
    gray: "border-gray-200 bg-white text-gray-700",
    emerald: "border-emerald-200 bg-white text-emerald-700",
    amber: "border-amber-200 bg-white text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm ${colors[color] || colors.gray}`}>
      <span className="font-bold">{value}</span> {label}
    </span>
  );
}

function FormField({ label, required, className, children }) {
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

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Media Preview Helper ────────────────────────────── */

function MediaPreview({ url }) {
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
