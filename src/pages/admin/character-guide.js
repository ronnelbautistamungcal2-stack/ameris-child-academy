import AdminLayout from "@/components/admin/AdminLayout";
import BehaviorEditor from "@/components/characterGuide/BehaviorEditor";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { BEHAVIOR_TYPES, typeLabel } from "@/lib/characterGuide";
import { useCallback, useEffect, useMemo, useState } from "react";

// Admin Character Guide (client mockups 40-08..13): the Decision Trees tab
// lists every behavior and character highlight with its tree; the
// Categories tab edits the category list in place.

const BLUE = "text-[#1d4ed8] dark:text-blue-200";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const PAGE_SIZES = [12, 24, 48];
const shortDate = (v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function AdminCharacterGuide() {
  const [tab, setTab] = useState("trees");
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await apiJson("/api/v1/character-guide/categories"));
    } catch (e) {
      setError(e.message || "Failed to load categories");
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return (
    <AdminLayout title="Character Guide">
      <div className="space-y-4">
        <h1 className={`text-4xl font-black ${BLUE}`}>Character Guide</h1>
        <div className="flex gap-6 border-b border-gray-200 text-sm font-semibold dark:border-gray-700" role="tablist">
          {[
            ["trees", "Decision Trees"],
            ["categories", "Categories"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 pb-2 ${tab === key ? "border-[#1d4ed8] text-[#1d4ed8] dark:border-blue-200 dark:text-blue-200" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!categories ? (
          <Skeleton className="h-64 w-full" />
        ) : tab === "trees" ? (
          <DecisionTrees categories={categories} onCategoriesChanged={loadCategories} />
        ) : (
          <Categories categories={categories} setCategories={setCategories} />
        )}
      </div>
    </AdminLayout>
  );
}

function DecisionTrees({ categories, onCategoriesChanged }) {
  const [rows, setRows] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/character-guide/behaviors")
      .then(setRows)
      .catch((e) => setError(e.message || "Failed to load behaviors"));
  }, []);
  useEffect(() => setPage(1), [categoryId, type, search, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter(
      (r) =>
        (!categoryId || r.categoryId === categoryId) &&
        (!type || r.type === type) &&
        (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
    );
  }, [rows, categoryId, type, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);

  function saved(row) {
    setRows((list) => (list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [row, ...list]));
    setEditing(null);
    onCategoriesChanged();
  }

  async function copy(row) {
    try {
      const created = await apiJson("/api/v1/character-guide/behaviors", {
        method: "POST",
        body: JSON.stringify({ type: row.type, name: `${row.name} (Copy)`, categoryId: row.categoryId, level: row.level, description: row.description, tree: row.tree }),
      });
      setRows((list) => [created, ...list]);
      onCategoriesChanged();
    } catch (e) {
      setError(e.message || "Failed to copy");
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete "${row.name}" and its decision tree?`)) return;
    try {
      await apiJson(`/api/v1/character-guide/behaviors/${row.id}`, { method: "DELETE" });
      setRows((list) => list.filter((r) => r.id !== row.id));
      onCategoriesChanged();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" className={control}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className={control}>
          <option value="">All Types</option>
          {BEHAVIOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search behaviors..." aria-label="Search behaviors" className={control} />
        <button type="button" onClick={() => setEditing({})} className="rounded-lg bg-[#1d4ed8] px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">+ Add Behavior</button>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {!rows ? (
          <div className="p-4"><Skeleton className="h-40 w-full" /></div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-blue-50 dark:bg-gray-800">
              <tr className={`text-left font-bold ${BLUE}`}>
                <th className="px-3 py-2">Behavior Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Last Updated</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setEditing(r)} className={`text-left text-base font-bold ${BLUE} hover:underline`}>{r.name}</button>
                    </td>
                    <td className={`px-3 py-2 ${BLUE}`}>{r.category?.name}</td>
                    <td className={`px-3 py-2 ${BLUE}`}>{typeLabel(r.type)}</td>
                    <td className={`max-w-sm px-3 py-2 ${BLUE}`}>{r.description}</td>
                    <td className={`whitespace-nowrap px-3 py-2 ${BLUE}`}>{shortDate(r.updatedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-lg">
                      <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`} title="Edit" className="px-1.5 text-[#1d4ed8]">✎</button>
                      <button type="button" onClick={() => copy(r)} aria-label={`Copy ${r.name}`} title="Copy" className="px-1.5 text-[#1d4ed8]">⧉</button>
                      <button type="button" onClick={() => remove(r)} aria-label={`Delete ${r.name}`} title="Delete" className="px-1.5 text-red-600">🗑</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{rows.length ? "No behaviors match these filters." : "No behaviors yet. Use Add Behavior to build the first decision tree."}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {rows && filtered.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">‹ Previous</button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" onClick={() => setPage(i + 1)} aria-current={page === i + 1 ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 ${page === i + 1 ? "border-[#1d4ed8] bg-[#1d4ed8] text-white" : "border-gray-300"}`}>{i + 1}</button>
            ))}
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next ›</button>
          </div>
          <div className={`flex items-center gap-2 ${BLUE}`}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(filtered.length, page * pageSize)} of {filtered.length} items
            <label className="flex items-center gap-1">Show
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-1 dark:bg-gray-800">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>
      ) : null}
      {editing ? <BehaviorEditor behavior={editing} categories={categories} onClose={() => setEditing(null)} onSaved={saved} /> : null}
    </div>
  );
}

function Categories({ categories, setCategories }) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const q = search.trim().toLowerCase();
  const shown = categories.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));

  async function save(category, patch) {
    if (Object.entries(patch).every(([k, v]) => (category[k] || "") === v)) return;
    try {
      const updated = await apiJson(`/api/v1/character-guide/categories/${category.id}`, { method: "PUT", body: JSON.stringify(patch) });
      setCategories((list) => list.map((c) => (c.id === category.id ? updated : c)));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to save the category");
    }
  }

  async function create(body) {
    try {
      const created = await apiJson("/api/v1/character-guide/categories", { method: "POST", body: JSON.stringify(body) });
      setCategories((list) => [...list, created]);
      setError("");
      return true;
    } catch (e) {
      setError(e.message || "Failed to add the category");
      return false;
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete the ${category.name} category?`)) return;
    try {
      await apiJson(`/api/v1/character-guide/categories/${category.id}`, { method: "DELETE" });
      setCategories((list) => list.filter((c) => c.id !== category.id));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to delete the category");
    }
  }

  async function addDraft() {
    if (!draft.name.trim()) return;
    if (await create(draft)) setDraft({ name: "", description: "" });
  }

  const cell = "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#1d4ed8] dark:border-gray-700 dark:bg-gray-800 dark:text-blue-200";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className={`text-sm ${BLUE}`}>Manage behavior categories to organize and group related behaviors for easier tracking and reporting.</p>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..." aria-label="Search categories" className={`${control} max-w-sm`} />
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-blue-50 dark:bg-gray-800">
            <tr className={`text-left font-bold ${BLUE}`}>
              <th className="w-1/4 px-2 py-2">Category Name</th>
              <th className="px-2 py-2">Description</th>
              <th className="w-28 px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-1">
                  <input defaultValue={c.name} key={`${c.id}-n-${c.name}`} onBlur={(e) => save(c, { name: e.target.value.trim() })} aria-label={`${c.name} name`} className={`${cell} font-bold`} />
                </td>
                <td className="px-2 py-1">
                  <input defaultValue={c.description || ""} key={`${c.id}-d-${c.description}`} onBlur={(e) => save(c, { description: e.target.value.trim() })} aria-label={`${c.name} description`} className={`${cell} font-normal`} />
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-center text-lg">
                  <button type="button" onClick={() => create({ name: `${c.name} (Copy)`, description: c.description || "" })} aria-label={`Copy ${c.name}`} title="Copy" className="px-1.5 text-[#1d4ed8]">⧉</button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Delete ${c.name}`}
                    title={c.behaviorCount ? `Used by ${c.behaviorCount} behavior(s)` : "Delete"}
                    className="px-1.5 text-red-600"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-2 py-1">
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addDraft()} placeholder="New category name" aria-label="New category name" className={`${cell} font-bold`} />
              </td>
              <td className="px-2 py-1">
                <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addDraft()} placeholder="Description" aria-label="New category description" className={`${cell} font-normal`} />
              </td>
              <td className="px-2 py-1 text-center">
                <button type="button" onClick={addDraft} disabled={!draft.name.trim()} className="rounded-lg bg-[#1d4ed8] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
