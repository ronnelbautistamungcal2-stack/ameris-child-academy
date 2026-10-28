import { PathwayDialog, TrainingDialog } from "@/components/training/TrainingDialogs";
import { ActivePill, Avatar, CategoryPill, NAVY, ProgressBar, StatusPill, card, fmtDate, thead } from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { ageGroupsLabel, rolesLabel } from "@/lib/training";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useCallback, useEffect, useState } from "react";

// Training Pathway detail (client mockups 13 and 18): the pathway's
// trainings, details, the staff assigned to it and a short report. Admins
// edit and delete; coaches see it read-only but sign off observations and
// hands-on training.

const TABS = [
  { key: "trainings", label: "Training List" },
  { key: "details", label: "Description & Details" },
  { key: "staff", label: "Assigned Staff" },
  { key: "reports", label: "Reports" },
];

export default function PathwayDetail({ pathwayId, backHref }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // { kind: "pathway"|"training", record? }
  const [confirm, setConfirm] = useState(null); // { kind: "pathway"|"remove", item? }
  const queryTab = typeof router.query.tab === "string" ? router.query.tab : "";
  const tab = TABS.some((t) => t.key === queryTab) ? queryTab : "trainings";

  const load = useCallback(async () => {
    if (!pathwayId) return;
    try {
      const res = await apiJson(`/api/v1/training/pathways/${pathwayId}`);
      setData(res);
    } catch (e) {
      setError(e.message || "Failed to load the pathway");
    }
  }, [pathwayId]);

  useEffect(() => {
    load();
  }, [load]);

  const centerId = data?.pathway?.centerId;
  const canManage = Boolean(data?.canManage);
  useEffect(() => {
    if (!canManage || !centerId) return;
    // The Add Training pop-up offers the center's other pathways too.
    apiJson(`/api/v1/training/pathways?centerId=${encodeURIComponent(centerId)}`)
      .then((res) => setLibrary(res.pathways || []))
      .catch(() => {});
  }, [canManage, centerId, data]);

  const setTab = (key) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });

  async function saveOrder(itemIds) {
    const p = data.pathway;
    await apiJson(`/api/v1/training/pathways/${p.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: p.title, category: p.category, description: p.description, appliesToRoles: p.appliesToRoles, ageGroups: p.ageGroups, materials: p.materials, active: p.active, itemIds }),
    });
    await load();
  }

  async function onConfirm() {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.kind === "pathway") {
        await apiJson(`/api/v1/training/pathways/${data.pathway.id}`, { method: "DELETE" });
        router.push(backHref);
      } else {
        await saveOrder(data.pathway.items.filter((i) => i.id !== c.item.id).map((i) => i.id));
      }
    } catch (e) {
      setError(e.message || "Something went wrong");
    }
  }

  async function signOff(userId, itemId, action) {
    try {
      await apiJson(`/api/v1/training/items/${itemId}/progress`, { method: "PUT", body: JSON.stringify({ action, userId }) });
      await load();
    } catch (e) {
      setError(e.message || "Failed to sign off");
    }
  }

  if (error && !data) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return <Skeleton count={6} />;
  const { pathway } = data;
  const items = pathway.items;

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm font-semibold text-blue-700 hover:underline">← Back to Training Pathways</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`text-3xl font-black ${NAVY}`}>{pathway.title}</h1>
            <ActivePill active={pathway.active} />
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{pathway.description}</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setDialog({ kind: "pathway", record: pathway })} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">✎ Edit Pathway</button>
            <button type="button" onClick={() => setConfirm({ kind: "pathway" })} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">🗑 Delete Pathway</button>
          </div>
        ) : null}
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className={`${card} grid gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6`}>
        <Fact label="Category"><CategoryPill value={pathway.category} /></Fact>
        <Fact label="Applies To (Roles)">{rolesLabel(pathway.appliesToRoles)}</Fact>
        <Fact label="Age Group(s)">{ageGroupsLabel(pathway.ageGroups)}</Fact>
        <Fact label="Total Trainings">{items.length}</Fact>
        <Fact label="Created">{fmtDate(pathway.createdAt)}{pathway.createdByName ? <span className="block text-xs text-gray-500">by {pathway.createdByName}</span> : null}</Fact>
        <Fact label="Last Updated">{fmtDate(pathway.updatedAt)}{pathway.updatedByName ? <span className="block text-xs text-gray-500">by {pathway.updatedByName}</span> : null}</Fact>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.filter((t) => data.canTrack || !["staff", "reports"].includes(t.key)).map((t) => (
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

      {tab === "trainings" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className={card}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className={`text-lg font-black ${NAVY}`}>Required Trainings ({items.length})</h2>
              {canManage ? (
                <button type="button" onClick={() => setDialog({ kind: "training" })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Add Training</button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={thead}>
                  <tr>
                    {["#", "Training Title", "Description", "Materials", canManage ? "Actions" : ""].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, i) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{i + 1}</td>
                      <td className="px-4 py-3 font-bold text-[#0b2a5b] dark:text-blue-100">{item.title}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.description}</td>
                      <td className="px-4 py-3">📎 {item.materials.length}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <span className="flex items-center gap-2">
                            <button type="button" disabled={i === 0} onClick={() => saveOrder(move(items, i, -1))} aria-label={`Move ${item.title} up`} className="text-gray-600 disabled:opacity-30">↑</button>
                            <button type="button" disabled={i === items.length - 1} onClick={() => saveOrder(move(items, i, 1))} aria-label={`Move ${item.title} down`} className="text-gray-600 disabled:opacity-30">↓</button>
                            <button type="button" onClick={() => setDialog({ kind: "training", record: { ...item, pathwayIds: undefined } })} aria-label={`Edit ${item.title}`} className="text-blue-700">✎</button>
                            <button type="button" onClick={() => setConfirm({ kind: "remove", item })} aria-label={`Remove ${item.title}`} className="text-red-600">🗑</button>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!items.length ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No trainings in this pathway yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className={`${card} p-4`}>
              <h3 className={`font-black ${NAVY}`}>Applies To</h3>
              <div className="mt-2 text-sm"><b>Roles</b><div className="text-gray-600">{rolesLabel(pathway.appliesToRoles)}</div></div>
              <div className="mt-2 text-sm"><b>Age Groups</b><div className="text-gray-600">{ageGroupsLabel(pathway.ageGroups)}</div></div>
            </div>
            <div className={`${card} p-4`}>
              <h3 className={`font-black ${NAVY}`}>Description</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{pathway.description}</p>
            </div>
            <div className={`${card} p-4 text-sm`}>
              <h3 className={`font-black ${NAVY}`}>Additional Information</h3>
              <p className="mt-2 text-gray-600">Created: {fmtDate(pathway.createdAt)}{pathway.createdByName ? ` by ${pathway.createdByName}` : ""}</p>
              <p className="text-gray-600">Last Updated: {fmtDate(pathway.updatedAt)}{pathway.updatedByName ? ` by ${pathway.updatedByName}` : ""}</p>
            </div>
          </div>
        </div>
      ) : tab === "details" ? (
        <div className={`${card} space-y-4 p-5`}>
          <div>
            <h2 className={`text-lg font-black ${NAVY}`}>Description</h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{pathway.description}</p>
          </div>
          <div>
            <h2 className={`text-lg font-black ${NAVY}`}>Pathway Materials</h2>
            {pathway.materials.length ? (
              <ul className="mt-1 space-y-1 text-sm">
                {pathway.materials.map((m, i) => (
                  <li key={`${m.url}-${i}`}><a href={m.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">{m.name}</a></li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No materials were added to this pathway.</p>
            )}
          </div>
          <div>
            <h2 className={`text-lg font-black ${NAVY}`}>Trainings</h2>
            <ul className="mt-1 space-y-2 text-sm">
              {items.map((item, i) => (
                <li key={item.id}>
                  <b>{i + 1}. {item.title}</b> <span className="text-gray-500">({item.category}{item.hours ? `, ${item.hours} hrs` : ""}{item.observationRequired ? ", observation" : ""}{item.handsOnRequired ? ", hands-on" : ""})</span>
                  <div className="text-gray-600 dark:text-gray-400">{item.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : tab === "staff" ? (
        <AssignedStaff rows={data.assignedStaff} items={items} itemProgress={data.itemProgress} canSignOff={data.canSignOff} onSignOff={signOff} />
      ) : (
        <PathwayReport rows={data.assignedStaff} items={items} itemProgress={data.itemProgress} />
      )}

      {dialog?.kind === "pathway" ? (
        <PathwayDialog
          centerId={pathway.centerId}
          pathway={pathway}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      ) : null}
      {dialog?.kind === "training" ? (
        <TrainingDialog
          centerId={pathway.centerId}
          training={dialog.record ? { ...dialog.record, pathwayIds: libraryPathwayIds(library, dialog.record.id, pathway.id) } : null}
          pathways={library.length ? library : [pathway]}
          defaultPathwayId={pathway.id}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "pathway" ? "Delete pathway?" : "Remove training?"}
        message={
          confirm?.kind === "pathway"
            ? `"${pathway.title}" will be removed. Its trainings stay in the Training Library.`
            : `"${confirm?.item?.title}" will be removed from this pathway. It stays in the Training Library.`
        }
        confirmLabel={confirm?.kind === "pathway" ? "Delete" : "Remove"}
        variant="danger"
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function libraryPathwayIds(pathways, itemId, fallbackId) {
  const ids = pathways.filter((p) => p.items.some((i) => i.id === itemId)).map((p) => p.id);
  return ids.length ? ids : [fallbackId];
}

function move(items, index, delta) {
  const ids = items.map((i) => i.id);
  const [id] = ids.splice(index, 1);
  ids.splice(index + delta, 0, id);
  return ids;
}

function Fact({ label, children }) {
  return (
    <div>
      <div className="text-xs font-bold text-[#0b2a5b] dark:text-blue-100">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

const REQUEST_TEXT = { NONE: "Not requested", REQUESTED: "Requested", COMPLETED: "Signed off" };

function AssignedStaff({ rows, items, itemProgress, canSignOff, onSignOff }) {
  const [open, setOpen] = useState("");
  if (!rows.length) return <p className={`${card} p-4 text-sm text-gray-600`}>No current staff are assigned to this pathway (it applies to {items.length ? "roles no one has" : "no one"} yet).</p>;
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="min-w-full text-sm">
        <thead className={thead}>
          <tr>
            {["Staff Name", "Role", "Completed", "Progress", "Last Activity", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => (
            <Fragment key={r.userId}>
              <tr>
                <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><Avatar name={r.name} />{r.name}</span></td>
                <td className="px-4 py-3">{r.role}</td>
                <td className="px-4 py-3">{r.completed} of {r.required}</td>
                <td className="px-4 py-3"><ProgressBar pct={r.pct} /></td>
                <td className="px-4 py-3">{fmtDate(r.lastActivity)}</td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(open === r.userId ? "" : r.userId)} aria-expanded={open === r.userId} className="text-sm font-semibold text-blue-700 hover:underline">
                    {open === r.userId ? "Hide" : "Details"}
                  </button>
                </td>
              </tr>
              {open === r.userId ? (
                <tr>
                  <td colSpan={7} className="bg-gray-50 px-6 py-3 dark:bg-gray-800">
                    <ul className="space-y-2">
                      {items.map((item) => {
                        const p = itemProgress[r.userId]?.[item.id];
                        return (
                          <li key={item.id} className="flex flex-wrap items-center gap-3">
                            <span className="min-w-[12rem] font-semibold">{item.title}</span>
                            <StatusPill status={p?.status} />
                            {item.observationRequired ? (
                              <SignOff label="Observation" status={p?.observationStatus || "NONE"} canSignOff={canSignOff} onClick={() => onSignOff(r.userId, item.id, "observationDone")} />
                            ) : null}
                            {item.handsOnRequired ? (
                              <SignOff label="Hands-on" status={p?.handsOnStatus || "NONE"} canSignOff={canSignOff} onClick={() => onSignOff(r.userId, item.id, "handsOnDone")} />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignOff({ label, status, canSignOff, onClick }) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-gray-600">{label}: <b>{REQUEST_TEXT[status]}</b></span>
      {canSignOff && status !== "COMPLETED" ? (
        <button type="button" onClick={onClick} className="rounded-md border border-blue-300 bg-white px-2 py-0.5 font-bold text-blue-700 hover:bg-blue-50">Sign Off {label}</button>
      ) : null}
    </span>
  );
}

function PathwayReport({ rows, items, itemProgress }) {
  const assigned = rows.length;
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
  const avg = assigned ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / assigned) : 0;
  const stats = [
    ["Assigned Staff", assigned],
    ["Completed", completed],
    ["In Progress", inProgress],
    ["Not Started", assigned - completed - inProgress],
    ["Average Progress", `${avg}%`],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className={`${card} p-4`}>
            <div className="text-xs font-bold text-gray-500">{label}</div>
            <div className={`mt-1 text-2xl font-black ${NAVY}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className={thead}>
            <tr>{["Training", "Completed", "In Progress", "Not Started", "Completion"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const statuses = rows.map((r) => itemProgress[r.userId]?.[item.id]?.status || "NOT_STARTED");
              const done = statuses.filter((s) => s === "COMPLETED").length;
              const doing = statuses.filter((s) => s === "IN_PROGRESS").length;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold">{item.title}</td>
                  <td className="px-4 py-3">{done}</td>
                  <td className="px-4 py-3">{doing}</td>
                  <td className="px-4 py-3">{assigned - done - doing}</td>
                  <td className="px-4 py-3"><ProgressBar pct={assigned ? Math.round((done * 100) / assigned) : 0} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
