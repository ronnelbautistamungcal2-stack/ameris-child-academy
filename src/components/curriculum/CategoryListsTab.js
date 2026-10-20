import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiJson } from "@/lib/api";
import { OPTION_LISTS } from "@/lib/curriculumOptions";
import { useCallback, useEffect, useState } from "react";

// Curriculum > Categories (client mockup 2026-10-02): four lists side by side
// (Categories, Subjects, Age Ranges, Type) that feed the dropdowns on the
// New Lesson and Add Step forms. Type a name in the blank row to add one.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";

export default function CategoryListsTab({ centerId }) {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setLists(await apiJson(`/api/v1/curriculum-options?centerId=${encodeURIComponent(centerId)}`));
    } catch (e) {
      setError(e.message || "Could not load the lists");
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(kind, name) {
    setError("");
    try {
      const row = await apiJson("/api/v1/curriculum-options", { method: "POST", body: JSON.stringify({ centerId, kind, name }) });
      setLists((prev) => ({
        ...prev,
        [kind]: [...prev[kind], row].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      }));
      return true;
    } catch (e) {
      setError(e.message || "Could not add it");
      return false;
    }
  }

  async function remove(row) {
    setRemoving(null);
    setError("");
    try {
      await apiJson(`/api/v1/curriculum-options?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setLists((prev) => ({ ...prev, [row.kind]: prev[row.kind].filter((r) => r.id !== row.id) }));
    } catch (e) {
      setError(e.message || "Could not remove it");
    }
  }

  return (
    <div className="space-y-3">
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {OPTION_LISTS.map((list) => (
          <OptionList
            key={list.kind}
            list={list}
            rows={lists?.[list.kind] || []}
            loading={!lists}
            onAdd={(name) => add(list.kind, name)}
            onRemove={(row) => setRemoving({ ...row, kind: list.kind, listTitle: list.title })}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">
        These lists fill the dropdowns on the New Lesson and Add Step forms. Removing an entry takes it off the dropdowns; lessons that already use it keep it.
      </p>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove from the list?"
        message={removing ? `Remove "${removing.name}" from ${removing.listTitle}?` : ""}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function OptionList({ list, rows, loading, onAdd, onRemove }) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const q = search.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;

  async function submit() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    if (await onAdd(draft)) setDraft("");
    setSaving(false);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-label={list.title}>
      <h2 className={`flex items-center gap-2 text-2xl font-black ${NAVY}`}>
        <span aria-hidden>{list.icon}</span> {list.title}
      </h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={list.search}
        aria-label={list.search}
        className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
      />
      <div className="mt-3 max-h-[480px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr className={`bg-blue-50 text-left font-bold dark:bg-gray-800 ${NAVY}`}>
            <th className="px-2 py-1.5">{list.column}</th>
            <th className="w-16 px-2 py-1.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={2} className="px-2 py-4 text-center text-xs text-gray-500">Loading...</td>
            </tr>
          )}
          {shown.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-2 py-1.5 text-[#0b2a5b] dark:text-blue-100">{row.name}</td>
              <td className="px-2 py-1.5 text-center">
                <button type="button" onClick={() => onRemove(row)} aria-label={`Remove ${row.name}`} title="Remove" className="rounded px-1.5 text-red-600 hover:bg-red-50">
                  {"\u{1F5D1}"}
                </button>
              </td>
            </tr>
          ))}
          {!loading && q && !shown.length && (
            <tr>
              <td colSpan={2} className="px-2 py-3 text-center text-xs text-gray-500">No matches.</td>
            </tr>
          )}
          <tr>
            <td className="px-2 py-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={120}
                placeholder={`Add ${list.column.toLowerCase()}...`}
                aria-label={`New ${list.column.toLowerCase()}`}
                disabled={loading}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </td>
            <td className="px-2 py-1.5 text-center">
              <button type="button" onClick={submit} disabled={!draft.trim() || saving} className="rounded px-2 text-sm font-bold text-blue-700 disabled:opacity-30">
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>
  );
}
