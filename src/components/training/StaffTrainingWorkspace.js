import RecordTrainingDialog from "@/components/training/RecordTrainingDialog";
import { LibraryTab } from "@/components/training/StaffPDWorkspace";
import { Avatar, Modal, NAVY, Pager, card, control, fmtDate, initials, pageRows, thead } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

// Coach - Staff Training (client mockups 07-10): staff with the training
// hours they completed in a date range, Record Training for attendees, View
// Training per employee with Print Report, and the Training Management list
// (read-only) in a collapsible section.

const fmtHours = (n) => (Number(n) || 0).toFixed(1);

function monthRange() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

export default function StaffTrainingWorkspace() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [range, setRange] = useState(monthRange);
  const [staff, setStaff] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

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
      const [hours, library] = await Promise.all([
        apiJson(`/api/v1/training/hours?${qs}&from=${range.from}&to=${range.to}`),
        apiJson(`/api/v1/training/items?${qs}`),
      ]);
      setStaff(hours);
      setItems(library);
    } catch (e) {
      setError(e.message || "Failed to load staff training");
    }
  }, [centerId, range]);

  useEffect(() => {
    setStaff(null);
    load();
  }, [load]);

  useEffect(() => setPage(1), [search, department, centerId]);

  const departments = useMemo(() => [...new Set((staff || []).map((s) => s.department).filter(Boolean))].sort(), [staff]);
  const q = search.trim().toLowerCase();
  const rows = (staff || []).filter((s) => (!q || s.name.toLowerCase().includes(q)) && (!department || s.department === department));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`}>Staff Training</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-60`}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {centerId ? (
            <button type="button" onClick={() => setRecording(true)} disabled={!staff} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">+ Record Training</button>
          ) : null}
        </div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!centerId ? (
        <p className={`${card} p-4 text-sm text-gray-600`}>Choose a center to see its staff training.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." aria-label="Search employees" className={`${control} w-64`} />
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-bold">
                From
                <input type="date" value={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={control} />
              </label>
              <label className="text-sm font-bold">
                To
                <input type="date" value={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={control} />
              </label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department" className={`${control} w-48`}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {!staff ? (
            <Skeleton count={6} />
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="min-w-full text-sm">
                <thead className={thead}>
                  <tr>{["Employee", "Position", "Department", "Training Hours Completed", "Action"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pageRows(rows, page).map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><Avatar name={s.name} />{s.name}</span></td>
                      <td className="px-4 py-3">{s.position}</td>
                      <td className="px-4 py-3">{s.department || "—"}</td>
                      <td className="px-4 py-3">{fmtHours(s.hours)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setViewing(s)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50">View Training</button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No employees found.</td></tr> : null}
                </tbody>
              </table>
              <Pager page={page} total={rows.length} noun="employees" onPage={setPage} />
            </div>
          )}

          <div className={card}>
            <button type="button" onClick={() => setLibraryOpen((o) => !o)} aria-expanded={libraryOpen} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className={`text-2xl font-black ${NAVY}`}>Training Management</span>
              <span className="text-xl text-gray-500" aria-hidden>{libraryOpen ? "▴" : "▾"}</span>
            </button>
            {libraryOpen ? <div className="px-4 pb-4">{items ? <LibraryTab items={items} canManage={false} /> : <Skeleton count={4} />}</div> : null}
          </div>
        </>
      )}

      {recording ? (
        <RecordTrainingDialog
          centerId={centerId}
          staff={staff || []}
          onClose={() => setRecording(false)}
          onSaved={async () => {
            setRecording(false);
            await load();
          }}
        />
      ) : null}
      {viewing ? <ViewTraining centerId={centerId} member={viewing} range={range} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

function ViewTraining({ centerId, member, range, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson(`/api/v1/training/hours?centerId=${encodeURIComponent(centerId)}&userId=${encodeURIComponent(member.id)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load training"));
  }, [centerId, member.id]);

  function print() {
    const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const rows = data.logs
      .map((l) => `<tr><td>${esc(l.topic)}</td><td>${esc(l.source || "")}</td><td>${esc(fmtDate(l.date))}</td><td>${fmtHours(l.nonInteractiveHours)}</td><td>${fmtHours(l.interactiveHours)}</td></tr>`)
      .join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Training Report - ${esc(member.name)}</title><style>
      body{font-family:system-ui,sans-serif;color:#0b2a5b;padding:24px}table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ccd;padding:6px 8px;text-align:left}th{background:#eef3fb}.tot{display:flex;gap:40px;margin-top:16px;font-size:14px}
    </style></head><body><h1>Training Report</h1><p><b>${esc(member.name)}</b> &middot; ${esc(member.position)}<br>Date Hired: ${esc(fmtDate(data.user.hireDate))}</p>
    <table><thead><tr><th>Topic</th><th>Source of Training</th><th>Date Completed</th><th>Non Interactive Time (Hours)</th><th>Interactive Time (Hours)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><span>Total Hours: <b>${fmtHours(data.totals.hours)}</b></span><span>Total Non-Interactive Hours: <b>${fmtHours(data.totals.nonInteractiveHours)}</b></span><span>Total Interactive Hours: <b>${fmtHours(data.totals.interactiveHours)}</b></span></div>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Modal title="View Training" onClose={onClose} wide footer={<button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-bold">Close</button>}>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {!data ? (
        <Skeleton count={5} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800">{initials(member.name)}</span>
              <div>
                <div className={`text-xl font-black ${NAVY}`}>{member.name}</div>
                <div className="text-sm text-gray-600">{member.position}</div>
              </div>
              <div className="ml-4 border-l border-gray-200 pl-4 text-sm">
                <div className="text-gray-500">Date Hired</div>
                <div className="font-semibold">{fmtDate(data.user.hireDate)}</div>
              </div>
            </div>
            <button type="button" onClick={print} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">🖨 Print Report</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className={thead}>
                <tr>{["Topic", "Source of Training", "Date Completed", "Non Interactive Time (Hours)", "Interactive Time (Hours)"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5">{l.topic}</td>
                    <td className="px-4 py-2.5">{l.source || "—"}</td>
                    <td className="px-4 py-2.5">{fmtDate(l.date)}</td>
                    <td className="px-4 py-2.5 text-center">{fmtHours(l.nonInteractiveHours)}</td>
                    <td className="px-4 py-2.5 text-center">{fmtHours(l.interactiveHours)}</td>
                  </tr>
                ))}
                {!data.logs.length ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No training recorded yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 rounded-xl bg-blue-50 p-4 text-center sm:grid-cols-3 dark:bg-gray-800">
            {[["Total Hours", data.totals.hours], ["Total Non-Interactive Hours", data.totals.nonInteractiveHours], ["Total Interactive Hours", data.totals.interactiveHours]].map(([label, value]) => (
              <div key={label}>
                <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
                <div className={`text-2xl font-black ${NAVY}`}>{fmtHours(value)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Shows all recorded training. The list on the page counts {fmtDate(range.from)} – {fmtDate(range.to)}.</p>
        </div>
      )}
    </Modal>
  );
}
