import { ChecklistIcon } from "@/components/checklists/ChecklistManagerPage";
import { ComposeDialog } from "@/components/messages/MessagesWorkspace";
import ActivityLogEntry, { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from "@/components/reports/ActivityLogEntry";
import { NAVY } from "@/components/reports/reportUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { formatDayKey, formatTaskTime, shiftDayKey, todayKey } from "@/lib/checklistTime";
import { EMPLOYEE_ROLES, roleLabel } from "@/lib/roles";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// Checklist Review (client request 2026-10-02, mockups 19-Checklist-Review):
// every staff member's checklist for a day, with a View Details pop-up where
// a coach or admin can mark items and see the Daily Log entries that person
// recorded.

const STATUS_OPTIONS = [
  { value: "COMPLETE", label: "Complete" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "ABSENT", label: "Absent" },
  { value: "NO_CHECKLIST", label: "No Checklist" },
  { value: "CLOSED", label: "Center Closed" },
];
const AVATAR_TONES = [
  "bg-pink-100 text-pink-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
];
// Kitchen included, Coach and Admin left out (client request 2026-10-29).
const ROLE_FILTER_OPTIONS = EMPLOYEE_ROLES.filter((r) => r !== "ADMIN" && r !== "COACH");
const selectClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function Avatar({ row, size = "h-9 w-9 text-xs" }) {
  const tone = AVATAR_TONES[[...String(row.id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return row.pictureUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.pictureUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full font-bold ${tone}`}>{initials(row.name)}</span>
  );
}

// "Today" means the update happened today, not that the reviewed day is
// today: an item ticked the evening before used to read "Today 4:58 PM" in
// the morning (client request 2026-10-29).
function formatUpdated(value) {
  if (!value) return "—";
  const d = new Date(value);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return todayKey(d) === todayKey() ? `Today ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function CompletionCell({ row }) {
  if (row.status === "ABSENT") return <span className="font-bold text-red-600">Absent</span>;
  if (row.status === "CLOSED") return <span className="text-gray-500">Center closed</span>;
  if (row.pct == null) return <span className="text-gray-500">No checklist</span>;
  const bar = row.pct >= 80 ? "bg-emerald-500" : row.pct >= 50 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="min-w-[140px]">
      <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{row.pct}%</div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${row.pct}%` }} />
      </div>
    </div>
  );
}

export default function ChecklistReview({ Layout, messagesPath }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((list) => {
        const all = Array.isArray(list) ? list : [];
        setCenters(all);
        if (all.length === 1) setCenterId(all[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  const load = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(`/api/v1/checklist-review?centerId=${encodeURIComponent(centerId)}&date=${date}`);
      setRows(data.rows || []);
    } catch (e) {
      setError(e.message || "Failed to load the checklist review");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [centerId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const rooms = useMemo(() => {
    const map = new Map();
    for (const r of rows) r.classRoomIds.forEach((id, i) => map.set(id, r.area.split(", ")[i] || id));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const shown = rows.filter((r) => {
    if (roleFilter && r.role !== roleFilter) return false;
    if (roomFilter && !r.classRoomIds.includes(roomFilter)) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    const needle = search.trim().toLowerCase();
    return !needle || `${r.name} ${r.position} ${r.area}`.toLowerCase().includes(needle);
  });

  return (
    <Layout title="Checklist Review">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChecklistIcon />
            <h1 className={`text-3xl font-black ${NAVY}`}>Checklist Review</h1>
          </div>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className={`text-sm font-bold ${NAVY}`}>Date</span>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={selectClass} aria-label="Date" />
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <button type="button" onClick={() => setDate(shiftDayKey(date, -1))} className="px-3 py-2 text-gray-600" aria-label="Previous day">‹</button>
              <button type="button" onClick={() => setDate(shiftDayKey(date, 1))} className="px-3 py-2 text-gray-600" aria-label="Next day">›</button>
            </div>
            <button type="button" onClick={() => setDate(todayKey())} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:bg-gray-800">
              Today
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* One center needs no picker (client request 2026-10-29). */}
            {centers.length > 1 ? (
              <label className="block">
                <span className={`text-sm font-bold ${NAVY}`}>Center</span>
                <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={selectClass} aria-label="Center">
                  <option value="">Select a center...</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className={`text-sm font-bold ${NAVY}`}>Department / Role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass} aria-label="Department / Role">
                <option value="">All Roles</option>
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`text-sm font-bold ${NAVY}`}>Classroom</span>
              <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className={selectClass} aria-label="Classroom">
                <option value="">All Classrooms</option>
                {rooms.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`text-sm font-bold ${NAVY}`}>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass} aria-label="Status">
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={`text-sm font-bold ${NAVY}`}>Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff members..." className={selectClass} aria-label="Search staff members" />
            </label>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {!centerId ? (
            <p className="p-6 text-sm text-gray-500">Choose a center to review its checklists.</p>
          ) : loading && !rows.length ? (
            <div className="p-6"><Skeleton count={6} /></div>
          ) : (
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Classroom / Area</th>
                  <th className="px-3 py-3">Checklist Completion</th>
                  <th className="px-3 py-3">Missing Items</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar row={row} />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.position}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.area}</td>
                    <td className="px-3 py-2.5"><CompletionCell row={row} /></td>
                    <td className="max-w-[220px] px-3 py-2.5 text-gray-700 dark:text-gray-300">
                      {row.status === "ABSENT" ? "—" : row.missing.length ? row.missing.slice(0, 3).join(", ") + (row.missing.length > 3 ? ` +${row.missing.length - 3} more` : "") : "—"}
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.notes || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300">{formatUpdated(row.lastUpdated)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button type="button" onClick={() => setDetailId(row.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!shown.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No staff members match these filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          {centerId && rows.length ? (
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800">
              Showing {shown.length} of {rows.length} staff members
            </div>
          ) : null}
        </div>
      </div>
      {detailId ? (
        <StaffChecklistDetails
          userId={detailId}
          centerId={centerId}
          centerName={centers.find((c) => c.id === centerId)?.name || ""}
          date={date}
          messagesPath={messagesPath}
          onClose={() => setDetailId("")}
          onChanged={load}
        />
      ) : null}
    </Layout>
  );
}

function StaffChecklistDetails({ userId, centerId, centerName, date, messagesPath, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("items");
  const [busy, setBusy] = useState(false);
  const [logFilter, setLogFilter] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await apiJson(`/api/v1/checklist-review/${userId}?centerId=${encodeURIComponent(centerId)}&date=${date}`));
    } catch (e) {
      setError(e.message || "Failed to load the details");
    }
  }, [userId, centerId, date]);

  useEffect(() => {
    load();
  }, [load]);

  // excused: mark the items Excused (left out of the total) instead of complete.
  async function mark(items, undo, excused = false) {
    setBusy(true);
    setError("");
    try {
      for (const item of items) {
        await apiJson("/api/v1/daily-checklists/complete", {
          method: "POST",
          body: JSON.stringify({ itemId: item.id, date, undo, forUserId: userId, excused }),
        });
      }
      await load();
      onChanged();
    } catch (e) {
      setError(e.message || "Failed to update the checklist");
    } finally {
      setBusy(false);
    }
  }

  const row = data?.row;
  const items = row?.items || [];
  const missing = items.filter((i) => !i.done && !i.excused);
  const listed = tab === "items" ? items : missing;
  const logs = data?.logs || [];
  const logCounts = logs.reduce((acc, log) => ({ ...acc, [log.type]: (acc[log.type] || 0) + 1 }), {});
  const shownLogs = logFilter === "ALL" ? logs : logFilter ? logs.filter((l) => l.type === logFilter) : [];
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === row?.status)?.label || "";
  // Add Open Point opens the message form here, so the review stays open
  // (client sheet 2026-11-07).
  const { data: session } = useSession();
  const [composing, setComposing] = useState(false);
  const [sentNotice, setSentNotice] = useState("");
  const composeSeed = row
    ? {
        threadType: "OPEN_POINT",
        recipient: { id: row.id, name: row.name, email: row.email || "" },
        subject: `Open point: checklist for ${formatDayKey(date, { month: "short", day: "numeric", year: "numeric" })}`,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8" role="dialog" aria-modal="true" aria-label="Staff Checklist Details">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className={`text-2xl font-black ${NAVY}`}>Staff Checklist Details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        {error ? <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!row ? (
          <div className="p-6"><Skeleton count={6} /></div>
        ) : (
          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-[1.2fr_1fr_1.3fr] dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Avatar row={row} size="h-14 w-14 text-lg" />
                <div>
                  <div className={`text-lg font-black ${NAVY}`}>{row.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{row.position} | {row.area}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{centerName}</div>
                </div>
              </div>
              <div className="md:border-l md:border-gray-200 md:pl-4 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Checklist Completion</div>
                {row.status === "ABSENT" ? (
                  <div className="text-2xl font-black text-red-600">Absent</div>
                ) : (
                  <>
                    <div className={`text-2xl font-black ${NAVY}`}>{row.pct ?? 0}%</div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.pct || 0}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{row.done} of {row.total} items completed</div>
                  </>
                )}
              </div>
              <div className="md:border-l md:border-gray-200 md:pl-4 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Daily Log Summary</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(logCounts).length ? (
                    Object.entries(logCounts).map(([type, count]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLogFilter(logFilter === type ? null : type)}
                        title={ACTIVITY_TYPE_LABELS[type] || type}
                        aria-label={`${ACTIVITY_TYPE_LABELS[type] || type}: ${count}`}
                        aria-pressed={logFilter === type}
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${logFilter === type ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700"}`}
                      >
                        <span>{ACTIVITY_ICONS[type] || "📄"}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{count}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No Daily Log entries this day.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl bg-blue-50/60 p-4 sm:grid-cols-4 dark:bg-gray-800">
              <div>
                <div className="text-xs font-semibold text-gray-500">Date</div>
                <div className={`font-bold ${NAVY}`}>{formatDayKey(date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">Status</div>
                <div className={`font-bold ${row.status === "COMPLETE" ? "text-emerald-700" : row.status === "ABSENT" ? "text-red-600" : NAVY}`}>{statusLabel}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">Last Updated</div>
                <div className={`font-bold ${NAVY}`}>{formatUpdated(row.lastUpdated)}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-gray-500">Daily Log Entries</div>
                  <div className={`font-bold ${NAVY}`}>{logs.length} total {logs.length === 1 ? "entry" : "entries"}</div>
                </div>
                <button type="button" onClick={() => setLogFilter(logFilter === "ALL" ? null : "ALL")} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:bg-gray-900">
                  View Daily Log
                </button>
              </div>
            </div>

            {logFilter ? (
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className={`text-sm font-bold ${NAVY}`}>
                    {logFilter === "ALL" ? "All Daily Log entries" : `${ACTIVITY_TYPE_LABELS[logFilter] || logFilter} entries`}
                  </div>
                  <button type="button" onClick={() => setLogFilter(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-800">Hide</button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {shownLogs.map((log) => (
                    <div key={log.id}>
                      <div className="text-xs font-semibold text-gray-500">{[log.child?.firstName, log.child?.lastName].filter(Boolean).join(" ")}</div>
                      <ActivityLogEntry activity={log} />
                    </div>
                  ))}
                  {!shownLogs.length ? <p className="text-sm text-gray-500">No entries.</p> : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-4">
                {[
                  ["items", `Checklist Items (${items.length})`],
                  ["missing", `Missing Items (${missing.length})`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`border-b-2 px-1 pb-2 text-sm font-bold ${tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pb-2">
                <button type="button" disabled={busy || !missing.length} onClick={() => mark(missing, false)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  Mark All Complete
                </button>
                <button type="button" disabled={busy || missing.length === items.length} onClick={() => mark(items.filter((i) => i.done || i.excused), true)} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  Mark All Incomplete
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-blue-50 text-left text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {listed.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-gray-700 dark:text-gray-300">{formatTaskTime(item.taskTime) || "—"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{item.title}</td>
                      <td className="px-3 py-2">
                        {item.excused ? (
                          <span className="font-semibold text-slate-600">Excused</span>
                        ) : item.done ? (
                          <span className="font-semibold text-emerald-700">✓ Completed</span>
                        ) : (
                          <span className="font-semibold text-amber-700">Not completed</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {/* Mark Incomplete / Mark Complete / Excused (client sheet 2026-11-07). */}
                        <select
                          aria-label={`Action for ${item.title}`}
                          disabled={busy}
                          value={item.excused ? "EXCUSED" : item.done ? "COMPLETE" : "INCOMPLETE"}
                          onChange={(e) => {
                            const action = e.target.value;
                            if (action === "INCOMPLETE") mark([item], true);
                            else mark([item], false, action === "EXCUSED");
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        >
                          <option value="INCOMPLETE">Mark Incomplete</option>
                          <option value="COMPLETE">Mark Complete</option>
                          <option value="EXCUSED">Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!listed.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-500">{tab === "items" ? "No checklist items are due this day." : "Nothing is missing."}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button type="button" disabled={!row} onClick={() => { setSentNotice(""); setComposing(true); }} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              💬 Add Open Point
            </button>
            {sentNotice ? (
              <span role="status" className="text-sm font-semibold text-emerald-700">
                {sentNotice}{" "}
                <Link href={messagesPath} className="underline">View in Messages</Link>
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">
            Close
          </button>
        </div>
      </div>
      {composing && composeSeed ? (
        <ComposeDialog
          seed={composeSeed}
          userId={session?.user?.id}
          role={String(session?.user?.role || "").toUpperCase()}
          workflowView
          onClose={() => setComposing(false)}
          onCreated={() => {
            setComposing(false);
            setSentNotice("Open point sent.");
          }}
        />
      ) : null}
    </div>
  );
}
