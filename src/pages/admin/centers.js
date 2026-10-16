import AdminLayout from "@/components/admin/AdminLayout";
import CenterFormModal from "@/components/admin/CenterFormModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { CENTER_STATUSES } from "@/lib/centerSettings";
import { EMPLOYEE_ROLES } from "@/lib/roles";
import { useEffect, useMemo, useState } from "react";

// Centers (client mockup 2026-10-02): totals, filters, and a table of centers
// whose edit icon opens the same Add Center tabs filled in.

const STATUS_STYLES = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  INACTIVE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function statusLabel(value) {
  return CENTER_STATUSES.find((s) => s.value === value)?.label || "Active";
}

function staffCount(center) {
  return (center.users || []).filter((u) => EMPLOYEE_ROLES.includes(u.role)).length;
}

const select = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

export default function AdminCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ status: "", region: "", director: "" });
  const [formCenter, setFormCenter] = useState(null); // {} = add, center = edit
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function refresh() {
    setError("");
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const regions = useMemo(() => [...new Set(centers.map((c) => c.region).filter(Boolean))].sort(), [centers]);
  const directors = useMemo(() => {
    const map = new Map();
    for (const c of centers) if (c.director) map.set(c.director.id, c.director.name || c.director.email);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [centers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return centers
      .filter((c) => !filters.status || (c.status || "ACTIVE") === filters.status)
      .filter((c) => !filters.region || c.region === filters.region)
      .filter((c) => !filters.director || c.directorId === filters.director)
      .filter((c) => !q || [c.name, c.city, c.address, c.director?.name].some((v) => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [centers, filters, query]);

  const totals = useMemo(
    () => ({
      centers: centers.length,
      children: centers.reduce((sum, c) => sum + (c._count?.children || 0), 0),
      staff: centers.reduce((sum, c) => sum + staffCount(c), 0),
    }),
    [centers],
  );

  async function openEdit(center) {
    setError("");
    try {
      // The full record carries the Care & Schedule and Ages & Rates settings.
      setFormCenter(await apiJson(`/api/v1/centers/${center.id}`));
    } catch (e) {
      setError(e.message || "Failed to open the center");
    }
  }

  async function deleteCenter() {
    const target = deleteTarget;
    setDeleteTarget(null);
    setError("");
    try {
      await apiJson(`/api/v1/centers/${target.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to delete center");
    }
  }

  const filtered = filters.status || filters.region || filters.director || query;

  return (
    <AdminLayout title="Centers">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Total Centers", totals.centers, "bg-violet-50 text-violet-900 border-violet-100"],
              ["Total Children", totals.children, "bg-emerald-50 text-emerald-900 border-emerald-100"],
              ["Total Staff", totals.staff, "bg-sky-50 text-sky-900 border-sky-100"],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl border px-5 py-4 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${tone}`}>
                <div className="text-3xl font-black">{loading ? "—" : value}</div>
                <div className="text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setFormCenter({})} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            + Add Center
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search centers..."
              aria-label="Search centers"
              className={`${select} min-w-[220px] flex-1`}
            />
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Status
              <select className={`${select} mt-1 block w-40`} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All</option>
                {CENTER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Region
              <select className={`${select} mt-1 block w-40`} value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}>
                <option value="">All</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Director
              <select className={`${select} mt-1 block w-44`} value={filters.director} onChange={(e) => setFilters({ ...filters, director: e.target.value })}>
                <option value="">All</option>
                {directors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <button
              type="button"
              disabled={!filtered}
              onClick={() => {
                setQuery("");
                setFilters({ status: "", region: "", director: "" });
              }}
              className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-300"
            >
              Clear Filters
            </button>
          </div>

          {error ? <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <SkeletonTable rows={4} cols={6} />
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-blue-950 dark:border-gray-700 dark:text-gray-300">
                    <th className="px-3 py-2">Center Name</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Director</th>
                    <th className="px-3 py-2 text-center">Children</th>
                    <th className="px-3 py-2 text-center">Staff</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt="" className="h-11 w-16 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-11 w-16 items-center justify-center rounded-md bg-blue-50 text-xl dark:bg-gray-800" aria-hidden="true">{"\u{1F3EB}"}</div>
                          )}
                          <span className="font-bold text-blue-900 dark:text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        <div>{c.address || "—"}</div>
                        {c.city || c.state ? <div className="text-xs text-gray-500">{[c.city, c.state].filter(Boolean).join(", ")}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {c.director ? (
                          <>
                            <div className="font-medium text-blue-900 dark:text-white">{c.director.name || c.director.email}</div>
                            <div className="text-xs text-gray-500">{c.director.email}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">{"—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{c._count?.children ?? 0}</td>
                      <td className="px-3 py-2 text-center">{staffCount(c)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-md px-3 py-1 text-xs font-bold ${STATUS_STYLES[c.status] || STATUS_STYLES.ACTIVE}`}>{statusLabel(c.status)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => openEdit(c)} className="rounded-md px-2 py-1 text-lg text-blue-700 hover:bg-blue-50 dark:text-blue-300" title="Edit center" aria-label={`Edit ${c.name}`}>
                          &#9998;
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(c)} className="rounded-md px-2 py-1 text-lg text-red-600 hover:bg-red-50" title="Delete center" aria-label={`Delete ${c.name}`}>
                          &#128465;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">{filtered ? "No centers match these filters." : "No centers yet."}</p>
            ) : null}
          </div>
        </div>
      </div>

      {formCenter ? (
        <CenterFormModal
          center={formCenter.id ? formCenter : null}
          onClose={() => setFormCenter(null)}
          onSaved={async () => {
            setFormCenter(null);
            await refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete center?"
        message={deleteTarget ? `Delete ${deleteTarget.name} and everything in it? This cannot be undone.` : ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={deleteCenter}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
