import Pager from "@/components/ui/Pager";
import { MAX_FILE_BYTES, NAVY, StatusPill, ageLabel, formatDate, toInputDate, uploadFile } from "@/components/ipp/ippUi";
import { apiJson } from "@/lib/api";
import { scheduleLabel } from "@/lib/ipp";
import { useMemo, useState } from "react";

// The child's Individual Progress Plan (client mockups 2026-10-02): a header
// card, then Plan Overview, IPP Log and Documents & Notes. With `readOnly`
// (parents and teachers) only the overview is shown.

const card = "rounded-2xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900";
const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const TABS = [
  ["overview", "Plan Overview"],
  ["log", "IPP Log"],
  ["documents", "Documents & Notes"],
];

export function PlanHeader({ plan }) {
  const c = plan.child;
  const facts = [
    ["Plan Start Date", formatDate(plan.startDate)],
    ["Review Schedule", scheduleLabel(plan.reviewSchedule) || "—"],
    ["Next Review Date", formatDate(plan.nextReviewDate)],
  ];
  return (
    <div className={`${card} flex flex-col gap-4 p-4 xl:flex-row xl:items-center`}>
      <div className="flex items-center gap-4">
        {c.photoUrl ? (
          <img src={c.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-black text-blue-800" aria-hidden>
            {c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
          </div>
        )}
        <div className="text-sm text-[#0b2a5b] dark:text-blue-100">
          <div className="text-xl font-black">{c.name}</div>
          <div>
            Date of Birth: <b>{formatDate(c.birthDate)}</b>
            {c.birthDate ? <> {"·"} Age: <b>{ageLabel(c.birthDate)}</b></> : null}
          </div>
          {c.classroom && <div>Classroom: <b>{c.classroom}</b></div>}
          {c.teacher && <div>Teacher: <b>{c.teacher}</b></div>}
          {c.parent && <div>Parent/Guardian: <b>{c.parent}</b></div>}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 border-gray-200 sm:grid-cols-4 xl:border-l xl:pl-4 dark:border-gray-700">
        {facts.map(([k, v]) => (
          <div key={k} className="text-sm">
            <div className="text-gray-500">{k}</div>
            <div className={`font-bold ${NAVY}`}>{v}</div>
          </div>
        ))}
        <div className="text-sm">
          <div className="text-gray-500">Status</div>
          <StatusPill status={plan.status} />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{value}%</span>
    </div>
  );
}

export function PlanOverview({ plan }) {
  const [open, setOpen] = useState(() => new Set(plan.goals.slice(0, 1).map((g) => g.id)));
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`${card} bg-blue-50/60 p-4 dark:bg-gray-800/60`}>
          <h3 className={`font-black ${NAVY}`}>{"\u{1F4C4}"} Plan Purpose / Overview</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{plan.purpose || "—"}</p>
        </div>
        <div className={`${card} bg-blue-50/60 p-4 dark:bg-gray-800/60`}>
          <h3 className={`font-black ${NAVY}`}>{"\u{1F3AF}"} Measurable Outcomes</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{plan.measurableOutcomes || "—"}</p>
        </div>
      </div>
      {plan.disciplinaryAction ? (
        <div className={`${card} p-4`}>
          <h3 className={`font-black ${NAVY}`}>Disciplinary Action</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{plan.disciplinaryAction}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className={`text-lg font-black ${NAVY}`}>{"\u{1F3AF}"} Goals</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Each goal with its strategies and supports. Click a goal to expand or collapse it.</p>
        </div>
        <div className={`${card} px-4 py-2 text-sm`}>
          <div className={`font-bold ${NAVY}`}>Champion</div>
          <div className="text-gray-700 dark:text-gray-300">{plan.champion}</div>
        </div>
      </div>

      {plan.goals.map((g, i) => {
        const strategies = g.strategies.filter((s) => s.kind !== "SUPPORT");
        const supports = g.strategies.filter((s) => s.kind === "SUPPORT");
        const isOpen = open.has(g.id);
        return (
          <div key={g.id} className={card}>
            <button type="button" onClick={() => toggle(g.id)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left">
              <span className={`flex-1 font-bold ${NAVY}`}>
                <span aria-hidden className="mr-2">{isOpen ? "▾" : "▸"}</span>
                {i + 1}. {g.title}
              </span>
              <span className="text-xs">
                <span className="block text-gray-500">Domain</span>
                <span className="rounded-md bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{g.domain}</span>
              </span>
              <span className="text-xs">
                <span className="block text-gray-500">Target Date</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{formatDate(g.targetDate)}</span>
              </span>
              <span className="text-xs">
                <span className="block text-gray-500">Progress</span>
                <ProgressBar value={g.progress} />
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-1 gap-3 border-t border-gray-100 p-4 md:grid-cols-2 dark:border-gray-800">
                <div>
                  <h4 className={`font-bold ${NAVY}`}>{"⚙️"} Strategies</h4>
                  <table className="mt-1 w-full text-sm">
                    <thead>
                      <tr className={`bg-blue-50 text-left text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                        <th className="w-8 px-2 py-1">#</th>
                        <th className="px-2 py-1">Strategy</th>
                        <th className="px-2 py-1">Role Responsible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategies.map((s, k) => (
                        <tr key={s.id || k} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-2 py-1">{k + 1}</td>
                          <td className="px-2 py-1">
                            {s.text}
                            {s.frequency && <span className="block text-xs text-gray-500">{s.frequency}</span>}
                            {s.documents.map((d) => (
                              <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-700 hover:underline dark:text-blue-300">{"\u{1F4CE}"} {d.name}</a>
                            ))}
                          </td>
                          <td className="px-2 py-1">{s.role || "—"}</td>
                        </tr>
                      ))}
                      {!strategies.length && (
                        <tr>
                          <td colSpan={3} className="px-2 py-2 text-xs text-gray-500">No strategies yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 className={`font-bold ${NAVY}`}>{"\u{1F465}"} Supports</h4>
                  <table className="mt-1 w-full text-sm">
                    <thead>
                      <tr className={`bg-blue-50 text-left text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                        <th className="w-8 px-2 py-1">#</th>
                        <th className="px-2 py-1">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supports.map((s, k) => (
                        <tr key={s.id || k} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-2 py-1">{k + 1}</td>
                          <td className="px-2 py-1">
                            {s.text}
                            {s.role && <span className="block text-xs text-gray-500">{s.role}{s.frequency ? ` · ${s.frequency}` : ""}</span>}
                          </td>
                        </tr>
                      ))}
                      {!supports.length && (
                        <tr>
                          <td colSpan={2} className="px-2 py-2 text-xs text-gray-500">No supports yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DATE_RANGES = [
  ["", "All Dates"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
];

function IppLog({ plan, onChanged }) {
  const [filters, setFilters] = useState({ range: "", goalId: "", enteredBy: "" });
  const [sort, setSort] = useState({ key: "date", dir: -1 });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState({ date: toInputDate(new Date()), goalId: "", tactic: "", tacticDetail: "", observation: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const staff = [...new Set(plan.logs.map((l) => l.enteredBy))].sort();
  const visible = useMemo(() => {
    const cutoff = filters.range ? toInputDate(new Date(Date.now() - Number(filters.range) * 86400000)) : "";
    const list = plan.logs.filter(
      (l) => (!cutoff || l.date >= cutoff) && (!filters.goalId || l.goalId === filters.goalId) && (!filters.enteredBy || l.enteredBy === filters.enteredBy),
    );
    return list.sort((a, b) => String(a[sort.key] || "").localeCompare(String(b[sort.key] || "")) * sort.dir);
  }, [plan.logs, filters, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * 10, current * 10);

  async function add() {
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/ipp/${plan.id}/logs`, { method: "POST", body: JSON.stringify(entry) });
      setEntry({ date: toInputDate(new Date()), goalId: "", tactic: "", tacticDetail: "", observation: "" });
      setAdding(false);
      await onChanged();
    } catch (e) {
      setError(e.message || "Could not add the entry");
    } finally {
      setSaving(false);
    }
  }

  const header = (key, text) => (
    <th className="px-3 py-2">
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))} className="inline-flex items-center gap-1" aria-label={`Sort by ${text}`}>
        {text}
        <span aria-hidden className="text-[10px] text-gray-400">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className={`${card} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-2xl font-black ${NAVY}`}>{"\u{1F4D3}"} IPP Log</h3>
        {plan.canLog && (
          <button type="button" onClick={() => setAdding((a) => !a)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            {adding ? "Cancel" : "+ Add Log Entry"}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-blue-50/60 p-3 md:grid-cols-4 dark:bg-gray-800/60">
          <label className={`text-sm font-bold ${NAVY}`}>
            Date
            <input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} className={`${control} mt-1 w-full`} />
          </label>
          <label className={`text-sm font-bold ${NAVY}`}>
            Goal
            <select value={entry.goalId} onChange={(e) => setEntry({ ...entry, goalId: e.target.value })} className={`${control} mt-1 w-full`}>
              <option value="">{"—"}</option>
              {plan.goals.map((g) => <option key={g.id} value={g.id}>{g.domain}: {g.title}</option>)}
            </select>
          </label>
          <label className={`text-sm font-bold ${NAVY} md:col-span-2`}>
            Tactic Used
            <input value={entry.tactic} onChange={(e) => setEntry({ ...entry, tactic: e.target.value })} maxLength={200} placeholder="e.g. First/Then Chart" className={`${control} mt-1 w-full`} />
          </label>
          <label className={`text-sm font-bold ${NAVY} md:col-span-2`}>
            How it was used
            <textarea rows={2} value={entry.tacticDetail} onChange={(e) => setEntry({ ...entry, tacticDetail: e.target.value })} maxLength={500} className={`${control} mt-1 w-full`} />
          </label>
          <label className={`text-sm font-bold ${NAVY} md:col-span-2`}>
            Observation Note
            <textarea rows={2} value={entry.observation} onChange={(e) => setEntry({ ...entry, observation: e.target.value })} maxLength={1000} className={`${control} mt-1 w-full`} />
          </label>
          {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-4">{error}</div>}
          <div className="md:col-span-4">
            <button type="button" onClick={add} disabled={saving} className="rounded-lg bg-[#0b2a5b] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className={`text-sm font-bold ${NAVY}`}>
          Date Range
          <select value={filters.range} onChange={(e) => { setFilters({ ...filters, range: e.target.value }); setPage(1); }} className={`${control} mt-1 block w-44`}>
            {DATE_RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={`text-sm font-bold ${NAVY}`}>
          Goal
          <select value={filters.goalId} onChange={(e) => { setFilters({ ...filters, goalId: e.target.value }); setPage(1); }} className={`${control} mt-1 block w-56`}>
            <option value="">All Goals</option>
            {plan.goals.map((g) => <option key={g.id} value={g.id}>{g.domain}: {g.title}</option>)}
          </select>
        </label>
        <label className={`text-sm font-bold ${NAVY}`}>
          Entered By
          <select value={filters.enteredBy} onChange={(e) => { setFilters({ ...filters, enteredBy: e.target.value }); setPage(1); }} className={`${control} mt-1 block w-48`}>
            <option value="">All Staff</option>
            {staff.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={!Object.values(filters).some(Boolean)}
          onClick={() => setFilters({ range: "", goalId: "", enteredBy: "" })}
          className="ml-auto rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40 dark:text-blue-300"
        >
          Clear Filters
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className={`bg-blue-50 font-bold dark:bg-gray-800 ${NAVY}`}>
              {header("date", "Date")}
              {header("goal", "Goal")}
              {header("tactic", "Tactic Used")}
              {header("observation", "Observation Note")}
              {header("enteredBy", "Entered By")}
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 align-top text-gray-700 dark:border-gray-800 dark:text-gray-300">
                <td className="whitespace-nowrap px-3 py-2">{formatDate(l.date)}</td>
                <td className="px-3 py-2" title={l.goalTitle}>{l.goal || "—"}</td>
                <td className="px-3 py-2">
                  <div className={`font-bold ${NAVY}`}>{l.tactic}</div>
                  {l.tacticDetail && <div>{l.tacticDetail}</div>}
                </td>
                <td className="px-3 py-2">{l.observation || "—"}</td>
                <td className="px-3 py-2">{l.enteredBy}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No log entries{Object.values(filters).some(Boolean) ? " match these filters" : " yet"}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={`mt-2 flex items-center justify-between text-sm ${NAVY}`}>
        <span>Showing {shown.length} of {visible.length} entries</span>
        <Pager page={current} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}

function Documents({ plan, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState({});

  async function addFiles(files) {
    setError("");
    for (const file of Array.from(files || [])) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is over 10 MB.`);
        continue;
      }
      setUploading(true);
      try {
        const doc = await uploadFile(file);
        await apiJson(`/api/v1/ipp/${plan.id}/documents`, { method: "POST", body: JSON.stringify(doc) });
      } catch (e) {
        setError(e.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    }
    await onChanged();
  }

  async function saveNotes(doc) {
    if (!(doc.id in notes) || notes[doc.id] === doc.notes) return;
    try {
      await apiJson(`/api/v1/ipp/${plan.id}/documents`, { method: "PATCH", body: JSON.stringify({ documentId: doc.id, notes: notes[doc.id] }) });
      await onChanged();
    } catch (e) {
      setError(e.message || "Could not save the note");
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete ${doc.name}?`)) return;
    try {
      await apiJson(`/api/v1/ipp/${plan.id}/documents?documentId=${doc.id}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      setError(e.message || "Could not delete it");
    }
  }

  return (
    <div className={`${card} space-y-3 p-4`}>
      <h3 className={`text-2xl font-black ${NAVY}`}>{"\u{1F4C1}"} Documents &amp; Notes</h3>
      {plan.canManage && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-blue-300 px-4 py-5 text-center text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-800"
        >
          <span aria-hidden className="text-2xl">{"☁️"}</span>
          <span className="font-semibold">{uploading ? "Uploading..." : "Drag and drop files here or click to upload"}</span>
          <span className="text-xs text-gray-500">Supported file types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10 MB per file)</span>
          <input type="file" multiple className="sr-only" disabled={uploading} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className={`bg-blue-50 font-bold dark:bg-gray-800 ${NAVY}`}>
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-3 py-2">Document Name</th>
              <th className="px-3 py-2">File Type</th>
              <th className="px-3 py-2">Uploaded By</th>
              <th className="px-3 py-2">Date Uploaded</th>
              <th className="px-3 py-2">Notes</th>
              {plan.canManage && <th className="w-16 px-3 py-2 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {plan.documents.map((d, i) => (
              <tr key={d.id} className="border-t border-gray-100 align-top dark:border-gray-800">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline dark:text-blue-300">{d.name}</a>
                </td>
                <td className="px-3 py-2">{d.fileType || "—"}</td>
                <td className="px-3 py-2">{d.uploadedBy}</td>
                <td className="px-3 py-2">{formatDate(d.createdAt)}</td>
                <td className="px-3 py-2">
                  {plan.canManage ? (
                    <textarea
                      rows={1}
                      value={notes[d.id] ?? d.notes}
                      onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                      onBlur={() => saveNotes(d)}
                      placeholder="Add notes about this document..."
                      maxLength={500}
                      aria-label={`Notes for ${d.name}`}
                      className={`${control} w-full`}
                    />
                  ) : (
                    d.notes || "—"
                  )}
                </td>
                {plan.canManage && (
                  <td className="px-3 py-2 text-center">
                    <button type="button" onClick={() => remove(d)} aria-label={`Delete ${d.name}`} className="text-red-600">{"\u{1F5D1}"}</button>
                  </td>
                )}
              </tr>
            ))}
            {!plan.documents.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">No documents yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function IppPlanView({ plan, onChanged }) {
  const [tab, setTab] = useState("overview");
  return (
    <div className="ipp-print space-y-4">
      <PlanHeader plan={plan} />
      <div role="tablist" className={`${card} grid grid-cols-3 overflow-hidden print:hidden`}>
        {TABS.map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`border-b-4 py-3 text-sm font-semibold ${tab === key ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-[#0b2a5b] hover:bg-blue-50 dark:text-blue-100 dark:hover:bg-gray-800"}`}
          >
            {text}
          </button>
        ))}
      </div>
      {tab === "overview" && <PlanOverview plan={plan} />}
      {tab === "log" && <IppLog plan={plan} onChanged={onChanged} />}
      {tab === "documents" && <Documents plan={plan} onChanged={onChanged} />}
    </div>
  );
}
