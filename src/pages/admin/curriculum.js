import AdminLayout from "@/components/admin/AdminLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { key: "categories", label: "Categories" },
  { key: "lessons", label: "Lessons & Goals" },
  { key: "remediations", label: "Remediations" },
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
    <AdminLayout title="Curriculum Manager">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Curriculum Manager</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage categories, lessons, goals, and corrective learning paths.
          </p>

          <div className="mt-4">
            <label className="block max-w-xs">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
              >
                <option value="">Select a center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>

        {centerId && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    tab === t.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "categories" && <CategoriesTab centerId={centerId} />}
            {tab === "lessons" && <LessonsTab centerId={centerId} />}
            {tab === "remediations" && <RemediationsTab centerId={centerId} />}
          </>
        )}
      </div>
    </AdminLayout>
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-gray-900">Categories</h3>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          onClick={openCreate}
        >
          Add Category
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Edit / Create form */}
      {editing && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
          <h4 className="text-sm font-semibold text-gray-900">{editing === "new" ? "New Category" : "Edit Category"}</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Name</div>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Age Range</div>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="e.g. 0-2, 3-5" value={form.ageRange} onChange={(e) => setForm({ ...form, ageRange: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <div className="mb-1 text-xs font-semibold text-gray-500">Description</div>
              <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60" onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="mt-4"><Skeleton count={4} /></div>
      ) : categories.length === 0 ? (
        <div className="mt-4 text-sm text-gray-500">No categories yet.</div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Age Range</th>
                <th className="px-4 py-3">Lessons</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{cat.name}</div>
                    {cat.description && <div className="text-xs text-gray-500">{cat.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cat.ageRange || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{cat._count?.lessons ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700" onClick={() => openEdit(cat)}>Edit</button>
                      <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700" onClick={() => deleteCategory(cat.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Lessons & Goals Tab ─────────────────────────────── */

function LessonsTab({ centerId }) {
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", policyDocumentId: "", media: [] });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("");
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
      if (!q) return true;
      return (l.title || "").toLowerCase().includes(q) || (l.category?.name || "").toLowerCase().includes(q);
    });
  }, [lessons, categoryFilter, query]);

  function openCreate() {
    setEditing("new");
    setForm({ title: "", description: "", categoryId: "", policyDocumentId: "", media: [] });
  }

  function openEdit(lesson) {
    setEditing(lesson.id);
    setForm({
      title: lesson.title || "",
      description: lesson.description || "",
      categoryId: lesson.categoryId || "",
      policyDocumentId: lesson.policyDocumentId || "",
      media: lesson.media || [],
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        await apiJson("/api/v1/lessons", {
          method: "POST",
          body: JSON.stringify({ centerId, ...form, categoryId: form.categoryId || null, policyDocumentId: form.policyDocumentId || null }),
        });
      } else {
        await apiJson(`/api/v1/lessons/${encodeURIComponent(editing)}`, {
          method: "PUT",
          body: JSON.stringify({ ...form, categoryId: form.categoryId || null, policyDocumentId: form.policyDocumentId || null }),
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-gray-900">Lessons & Goals</h3>
        <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={openCreate}>
          Add Lesson
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Edit / Create form */}
      {editing && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
          <h4 className="text-sm font-semibold text-gray-900">{editing === "new" ? "New Lesson" : "Edit Lesson"}</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Title</div>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Category</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Linked Policy</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.policyDocumentId} onChange={(e) => setForm({ ...form, policyDocumentId: e.target.value })}>
                <option value="">None</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="block md:col-span-2">
              <div className="mb-1 text-xs font-semibold text-gray-500">Description</div>
              <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>

          {/* Media */}
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-gray-500">Attachments (Videos, Music, Documents)</div>
            <div className="flex flex-wrap gap-2">
              {form.media.map((url, i) => (
                <div key={i} className="group relative rounded-lg border border-gray-200 bg-white p-2">
                  <MediaPreview url={url} />
                  <button type="button" className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100" onClick={() => removeMedia(i)}>
                    x
                  </button>
                </div>
              ))}
              <label className="flex h-16 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500">
                + Add
                <input type="file" className="hidden" accept="video/*,audio/*,image/*,.pdf,.doc,.docx" onChange={handleMediaUpload} />
              </label>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60" onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Search lessons..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Lessons list */}
      {loading ? (
        <div className="mt-4"><Skeleton count={4} /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 text-sm text-gray-500">No lessons found.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((lesson) => (
            <div key={lesson.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{lesson.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    {lesson.category?.name && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">{lesson.category.name}</span>
                    )}
                    {lesson.policyDocument && (
                      <a href={lesson.policyDocument.url} target="_blank" rel="noreferrer" className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700 hover:bg-indigo-200 no-underline">
                        Policy: {lesson.policyDocument.title}
                      </a>
                    )}
                    <span>{lesson.goals?.length || 0} goals</span>
                    {lesson.media?.length > 0 && <span>{lesson.media.length} attachment(s)</span>}
                    {(lesson.remediationsFrom?.length || 0) > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        {lesson.remediationsFrom.length} remediation(s)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700" onClick={() => openEdit(lesson)}>Edit</button>
                  <button type="button" className="text-xs font-semibold text-gray-500 hover:text-gray-700" onClick={() => setExpanded((p) => ({ ...p, [lesson.id]: !p[lesson.id] }))}>
                    {expanded[lesson.id] ? "Collapse" : "Details"}
                  </button>
                </div>
              </div>

              {expanded[lesson.id] && (
                <div className="mt-3 space-y-3">
                  {lesson.description && <p className="text-sm text-gray-600">{lesson.description}</p>}

                  {/* Goals */}
                  {lesson.goals?.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold text-gray-500">Goals</div>
                      <div className="space-y-1">
                        {lesson.goals.map((g) => (
                          <div key={g.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                              Step {g.goalIndex}
                            </span>
                            <span className="text-gray-800">{g.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Media */}
                  {lesson.media?.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold text-gray-500">Attachments</div>
                      <div className="flex flex-wrap gap-2">
                        {lesson.media.map((url, i) => (
                          <div key={i} className="rounded-lg border border-gray-200 p-2">
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
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-gray-900">Corrective Learning Paths</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            onClick={handleAutoGeneratePreview}
            disabled={autoGenerating}
          >
            {autoGenerating ? "Analyzing..." : "Auto-Generate from Curriculum"}
          </button>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => setAdding(true)}>
            Add Link
          </button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Auto-generate commit result */}
      {commitResult && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h4 className="text-sm font-semibold text-emerald-800">Auto-Generation Complete</h4>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-emerald-200 bg-white px-2 py-1 font-semibold text-emerald-700">
              {commitResult.commitResult.created} links created
            </span>
            {commitResult.commitResult.updated > 0 && (
              <span className="rounded-lg border border-amber-200 bg-white px-2 py-1 font-semibold text-amber-700">
                {commitResult.commitResult.updated} links updated
              </span>
            )}
            {commitResult.commitResult.errors?.length > 0 && (
              <span className="rounded-lg border border-red-200 bg-white px-2 py-1 font-semibold text-red-700">
                {commitResult.commitResult.errors.length} errors
              </span>
            )}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
            onClick={() => setCommitResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Auto-generate preview */}
      {preview && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Auto-Generation Preview</h4>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700">
              {preview.stats.totalLessons} lessons analyzed
            </span>
            <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700">
              {preview.stats.bucketsFound} subject/age groups
            </span>
            <span className="rounded-lg border border-emerald-200 bg-white px-2 py-1 font-semibold text-emerald-700">
              {preview.stats.proposalsGenerated} new links to create
            </span>
            {preview.stats.skippedExisting > 0 && (
              <span className="rounded-lg border border-amber-200 bg-white px-2 py-1 font-semibold text-amber-700">
                {preview.stats.skippedExisting} already exist
              </span>
            )}
            {preview.stats.goalsWithoutRef > 0 && (
              <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-500">
                {preview.stats.goalsWithoutRef} goals without reference
              </span>
            )}
          </div>

          {preview.proposals.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {preview.proposals.slice(0, 50).map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2 text-xs">
                  <span className="max-w-[200px] truncate rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                    {p.fromLessonTitle}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="max-w-[200px] truncate rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    {p.toLessonTitle}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-gray-400">{p.age} / {p.subjectCode}</span>
                </div>
              ))}
              {preview.proposals.length > 50 && (
                <div className="text-center text-xs text-gray-500">
                  ... and {preview.proposals.length - 50} more
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              No new remediation links to generate. All sequential links already exist.
            </div>
          )}

          <div className="flex gap-2">
            {preview.proposals.length > 0 && (
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={handleAutoGenerateCommit}
                disabled={committing}
              >
                {committing ? "Creating..." : `Create ${preview.proposals.length} Links`}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">New Remediation Link</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">When this lesson fails</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">Select lesson...</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-gray-500">Recommend this corrective lesson</div>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select lesson...</option>
                {lessons.filter((l) => l.id !== fromId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-gray-500">Reason (optional)</div>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60" onClick={addLink} disabled={saving || !fromId || !toId}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4"><Skeleton count={4} /></div>
      ) : remediations.length === 0 ? (
        <div className="mt-4 text-sm text-gray-500">No remediation links yet.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {remediations.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-700">{r.fromLesson?.title || "?"}</span>
                <span className="text-gray-400">→</span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{r.toLesson?.title || "?"}</span>
                {r.reason && <span className="text-xs text-gray-500">({r.reason})</span>}
              </div>
              <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700" onClick={() => removeLink(r.fromLessonId, r.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Media Preview Helper ────────────────────────────── */

function MediaPreview({ url }) {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) {
    return <img src={url} alt="" className="h-14 w-14 rounded object-cover" />;
  }
  if (/\.(mp4|webm|mov)/.test(lower)) {
    return (
      <video src={url} className="h-14 w-20 rounded object-cover" preload="metadata" controls />
    );
  }
  if (/\.(mp3|wav|ogg|m4a)/.test(lower)) {
    return <audio src={url} className="h-8 w-32" controls preload="metadata" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center px-2 text-xs text-blue-600 hover:underline">
      {url.split("/").pop() || "Document"}
    </a>
  );
}
