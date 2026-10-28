import { PathwayDialog, TrainingDialog } from "@/components/training/TrainingDialogs";
import {
  ActivePill,
  Avatar,
  CategoryPill,
  NAVY,
  Pager,
  ProgressBar,
  StatusPill,
  card,
  control,
  fmtDate,
  pageRows,
  thead,
} from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { PROGRESS_STATUSES, TRAINING_AGE_GROUPS, TRAINING_ROLE_OPTIONS, TRAINING_TYPES, ageGroupsLabel, rolesLabel } from "@/lib/training";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

// Staff Professional Development (client mockups 11, 12, 14, 16): Training
// Pathways, Staff Progress and the Training Library. Admins add, edit and
// delete; coaches and HR see the same pages read-only.

const TABS = [
  { key: "pathways", label: "Training Pathways" },
  { key: "progress", label: "Staff Progress" },
  { key: "library", label: "Training Library" },
];

export default function StaffPDWorkspace({ detailHref }) {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [pathways, setPathways] = useState(null);
  const [items, setItems] = useState(null);
  const [progress, setProgress] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // { kind: "pathway"|"training", record? }
  const [deleting, setDeleting] = useState(null); // { kind, record }
  const queryTab = typeof router.query.tab === "string" ? router.query.tab : "";
  const tab = TABS.some((t) => t.key === queryTab) ? queryTab : "pathways";

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  const load = useCallback(async () => {
    if (!centerId) return;
    setError("");
    try {
      const qs = `centerId=${encodeURIComponent(centerId)}`;
      const [p, i, s] = await Promise.all([
        apiJson(`/api/v1/training/pathways?${qs}`),
        apiJson(`/api/v1/training/items?${qs}`),
        apiJson(`/api/v1/training/progress?${qs}`),
      ]);
      setPathways(p.pathways || []);
      setCanManage(Boolean(p.canManage));
      setItems(i);
      setProgress(s);
    } catch (e) {
      setError(e.message || "Failed to load training");
    }
  }, [centerId]);

  useEffect(() => {
    setPathways(null);
    load();
  }, [load]);

  const setTab = (key) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });

  async function confirmDelete() {
    const { kind, record } = deleting;
    setDeleting(null);
    try {
      await apiJson(kind === "pathway" ? `/api/v1/training/pathways/${record.id}` : `/api/v1/training/items/${record.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  const ready = pathways && items && progress;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`}>{tab === "library" ? "Training Library" : "Staff Training Pathway"}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-60`}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {canManage && centerId && tab === "pathways" ? (
            <button type="button" onClick={() => setDialog({ kind: "pathway" })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Add Training Pathway</button>
          ) : null}
          {canManage && centerId && tab === "library" ? (
            <button type="button" onClick={() => setDialog({ kind: "training" })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Add Training</button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-semibold ${tab === t.key ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!centerId ? (
        <p className={`${card} p-4 text-sm text-gray-600`}>Choose a center to see its training.</p>
      ) : !ready ? (
        <Skeleton count={6} />
      ) : tab === "pathways" ? (
        <PathwaysTab
          pathways={pathways}
          canManage={canManage}
          detailHref={detailHref}
          onEdit={(record) => setDialog({ kind: "pathway", record })}
          onDelete={(record) => setDeleting({ kind: "pathway", record })}
        />
      ) : tab === "progress" ? (
        <ProgressTab rows={progress} pathways={pathways} detailHref={detailHref} />
      ) : (
        <LibraryTab
          items={items}
          canManage={canManage}
          onEdit={(record) => setDialog({ kind: "training", record })}
          onDelete={(record) => setDeleting({ kind: "training", record })}
        />
      )}

      {dialog?.kind === "pathway" ? (
        <PathwayDialog
          centerId={centerId}
          pathway={dialog.record}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      ) : null}
      {dialog?.kind === "training" ? (
        <TrainingDialog
          centerId={centerId}
          training={dialog.record}
          pathways={pathways || []}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting?.kind === "pathway" ? "Delete pathway?" : "Delete training?"}
        message={
          deleting?.kind === "pathway"
            ? `"${deleting?.record.title}" will be removed. Its trainings stay in the Training Library.`
            : `"${deleting?.record.title}" and everyone's progress on it will be removed.`
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function FilterBar({ children, onClear }) {
  return (
    <div className={`${card} flex flex-wrap items-end gap-3 p-4`}>
      {children}
      <button type="button" onClick={onClear} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">Clear Filters</button>
    </div>
  );
}

function FilterSelect({ label, value, onChange, all, options }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <label className="min-w-[10rem] flex-1 text-sm font-bold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={control}>
        <option value="">{all}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function IconButtons({ onEdit, onDelete, name }) {
  return (
    <span className="flex items-center gap-3">
      <button type="button" onClick={onEdit} aria-label={`Edit ${name}`} className="text-blue-700 hover:text-blue-900">✎</button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${name}`} className="text-red-600 hover:text-red-800">🗑</button>
    </span>
  );
}

function usePage(deps) {
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), deps);
  return [page, setPage];
}

function PathwaysTab({ pathways, canManage, detailHref, onEdit, onDelete }) {
  const [f, setF] = useState({ category: "", role: "", age: "", status: "" });
  const categories = useMemo(() => [...new Set(pathways.map((p) => p.category).filter(Boolean))].sort(), [pathways]);
  const rows = pathways.filter(
    (p) =>
      (!f.category || p.category === f.category) &&
      (!f.role || !p.appliesToRoles.length || p.appliesToRoles.includes(f.role)) &&
      (!f.age || !p.ageGroups.length || p.ageGroups.includes(f.age)) &&
      (!f.status || (f.status === "ACTIVE") === p.active),
  );
  const [page, setPage] = usePage([f]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="space-y-4">
      <FilterBar onClear={() => setF({ category: "", role: "", age: "", status: "" })}>
        <FilterSelect label="Category" value={f.category} onChange={(v) => set({ category: v })} all="All Categories" options={categories} />
        <FilterSelect label="Applies To (Roles)" value={f.role} onChange={(v) => set({ role: v })} all="All Roles" options={TRAINING_ROLE_OPTIONS} />
        <FilterSelect label="Age Group(s)" value={f.age} onChange={(v) => set({ age: v })} all="All Age Groups" options={TRAINING_AGE_GROUPS} />
        <FilterSelect label="Status" value={f.status} onChange={(v) => set({ status: v })} all="All Statuses" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
      </FilterBar>
      <div className={`${card} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className={thead}>
            <tr>
              {["Pathway Name", "Description", "Category", "Applies To (Roles)", "Age Group(s)", "Total Trainings", "Status", canManage ? "Actions" : ""].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageRows(rows, page).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-bold">
                  <Link href={detailHref(p.id)} className="text-[#0b2a5b] hover:underline dark:text-blue-100">{p.title}</Link>
                </td>
                <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-400">{p.description}</td>
                <td className="px-4 py-3"><CategoryPill value={p.category} /></td>
                <td className="px-4 py-3">{rolesLabel(p.appliesToRoles)}</td>
                <td className="px-4 py-3">{ageGroupsLabel(p.ageGroups)}</td>
                <td className="px-4 py-3 text-center">{p.items.length}</td>
                <td className="px-4 py-3"><ActivePill active={p.active} /></td>
                <td className="px-4 py-3">{canManage ? <IconButtons name={p.title} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} /> : null}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">{pathways.length ? "No pathways match these filters." : "No training pathways yet."}</td></tr>
            ) : null}
          </tbody>
        </table>
        <Pager page={page} total={rows.length} noun="pathways" onPage={setPage} />
      </div>
    </div>
  );
}

function ProgressTab({ rows: allRows, pathways, detailHref }) {
  const [f, setF] = useState({ search: "", pathway: "", category: "", role: "", status: "" });
  const categories = useMemo(() => [...new Set(pathways.map((p) => p.category).filter(Boolean))].sort(), [pathways]);
  const q = f.search.trim().toLowerCase();
  const rows = allRows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q)) &&
      (!f.pathway || r.pathwayId === f.pathway) &&
      (!f.category || r.category === f.category) &&
      (!f.role || r.roles.includes(f.role)) &&
      (!f.status || r.status === f.status),
  );
  const [page, setPage] = usePage([f]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="space-y-4">
      <FilterBar onClear={() => setF({ search: "", pathway: "", category: "", role: "", status: "" })}>
        <label className="min-w-[12rem] flex-1 text-sm font-bold">
          Search Staff
          <input value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Search staff..." className={control} />
        </label>
        <FilterSelect label="Pathway" value={f.pathway} onChange={(v) => set({ pathway: v })} all="All Pathways" options={pathways.filter((p) => p.active).map((p) => ({ value: p.id, label: p.title }))} />
        <FilterSelect label="Category" value={f.category} onChange={(v) => set({ category: v })} all="All Categories" options={categories} />
        <FilterSelect label="Role" value={f.role} onChange={(v) => set({ role: v })} all="All Roles" options={TRAINING_ROLE_OPTIONS} />
        <FilterSelect label="Status" value={f.status} onChange={(v) => set({ status: v })} all="All Statuses" options={PROGRESS_STATUSES} />
      </FilterBar>
      <div className={`${card} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className={thead}>
            <tr>
              {["Staff Name", "Role", "Pathway", "Required Trainings", "Completed", "Progress", "Last Activity", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageRows(rows, page).map((r) => (
              <tr key={`${r.userId}-${r.pathwayId}`}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold"><Avatar name={r.name} />{r.name}</span>
                </td>
                <td className="px-4 py-3">{r.role}</td>
                <td className="px-4 py-3">{r.pathway}</td>
                <td className="px-4 py-3 text-center">{r.required}</td>
                <td className="px-4 py-3 text-center">{r.completed}</td>
                <td className="px-4 py-3"><ProgressBar pct={r.pct} /></td>
                <td className="px-4 py-3">{fmtDate(r.lastActivity)}</td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                <td className="px-4 py-3">
                  <Link href={`${detailHref(r.pathwayId)}?tab=staff`} aria-label={`View ${r.name} on ${r.pathway}`} className="text-blue-700 hover:text-blue-900">👁</Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">{allRows.length ? "No staff match these filters." : "No staff are assigned to an active pathway yet."}</td></tr>
            ) : null}
          </tbody>
        </table>
        <Pager page={page} total={rows.length} noun="staff members" onPage={setPage} />
      </div>
    </div>
  );
}

export function LibraryTab({ items, canManage, onEdit, onDelete }) {
  const [f, setF] = useState({ search: "", category: "", type: "", role: "" });
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const q = f.search.trim().toLowerCase();
  const rows = items.filter(
    (i) =>
      (!q || `${i.title} ${i.description}`.toLowerCase().includes(q)) &&
      (!f.category || i.category === f.category) &&
      (!f.type || i.type === f.type) &&
      (!f.role || !i.appliesToRoles.length || i.appliesToRoles.includes(f.role)),
  );
  const [page, setPage] = usePage([f]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-end gap-3 p-4`}>
        <label className="min-w-[14rem] flex-[2] text-sm font-bold">
          Search
          <input value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Search trainings..." className={control} />
        </label>
        <FilterSelect label="Category" value={f.category} onChange={(v) => set({ category: v })} all="All Categories" options={categories} />
        <FilterSelect label="Type" value={f.type} onChange={(v) => set({ type: v })} all="All Types" options={TRAINING_TYPES} />
        <FilterSelect label="Assigned To" value={f.role} onChange={(v) => set({ role: v })} all="All Staff" options={TRAINING_ROLE_OPTIONS} />
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className={thead}>
            <tr>
              {["Title", "Description", "Category", "Type", "Assigned To", "Pathway(s)", "Due Date", canManage ? "Actions" : ""].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageRows(rows, page).map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-bold text-[#0b2a5b] dark:text-blue-100">{i.title}</td>
                <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-400">{i.description}</td>
                <td className="px-4 py-3">{i.category}</td>
                <td className="px-4 py-3">{TRAINING_TYPES.find((t) => t.value === i.type)?.label}</td>
                <td className="px-4 py-3">{rolesLabel(i.appliesToRoles)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{i.pathways.map((p) => p.title).join(", ") || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(i.dueDate)}</td>
                <td className="px-4 py-3">{canManage ? <IconButtons name={i.title} onEdit={() => onEdit(i)} onDelete={() => onDelete(i)} /> : null}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">{items.length ? "No trainings match these filters." : "The Training Library is empty."}</td></tr>
            ) : null}
          </tbody>
        </table>
        <Pager page={page} total={rows.length} noun="training items" onPage={setPage} />
      </div>
    </div>
  );
}
