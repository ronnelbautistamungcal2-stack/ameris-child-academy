import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

// Child Time Sheet / Employee Time window (client mockups 2026-10-02). Opened
// from the clock icon on the Student List or Staff List. Past times can be
// corrected (the By column becomes the editor's initials and the change goes
// on the audit report), rows deleted, and a missing day added on the last row.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const toTimeInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const combine = (dateValue, timeValue) => (dateValue && timeValue ? new Date(`${dateValue}T${timeValue}`).toISOString() : null);
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");
const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

export default function TimeSheetModal({ kind, subjectId, subjects = [], onClose }) {
  const [currentId, setCurrentId] = useState(subjectId);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [edits, setEdits] = useState({}); // recordId -> { timeIn, timeOut } as "HH:MM"
  const [newRow, setNewRow] = useState({ date: "", timeIn: "", timeOut: "" });
  const [reportOpen, setReportOpen] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [range, setRange] = useState(() => {
    const now = new Date();
    return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
  });

  const base = `/api/v1/time-sheets/${kind}/${encodeURIComponent(currentId)}`;
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiJson(base));
    } catch (e) {
      setError(e.message || "Failed to load the time sheet");
    }
  }, [base]);

  // Employee time sheets the employee has e-signed and submitted.
  useEffect(() => {
    if (kind !== "staff") return;
    apiJson(`/api/v1/time-sheets/signatures?userId=${encodeURIComponent(currentId)}`)
      .then((rows) => setSignatures(Array.isArray(rows) ? rows : []))
      .catch(() => setSignatures([]));
  }, [kind, currentId]);

  useEffect(() => {
    setData(null);
    setEdits({});
    setSelectedId(null);
    setNewRow({ date: "", timeIn: "", timeOut: "" });
    load();
  }, [load]);

  const dirty = Object.keys(edits).length > 0 || Boolean(newRow.date || newRow.timeIn || newRow.timeOut);

  function close() {
    if (dirty && !confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  function editRow(row, field, value) {
    setEdits((current) => {
      const next = { ...current, [row.id]: { ...current[row.id], [field]: value } };
      const pending = next[row.id];
      const unchanged =
        (pending.timeIn === undefined || pending.timeIn === toTimeInput(row.timeIn)) &&
        (pending.timeOut === undefined || pending.timeOut === toTimeInput(row.timeOut));
      if (unchanged) delete next[row.id];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      for (const [recordId, change] of Object.entries(edits)) {
        const row = data.rows.find((r) => r.id === recordId);
        const day = toDateInput(new Date(row.day));
        const body = {};
        if (change.timeIn !== undefined) body.timeIn = combine(day, change.timeIn);
        if (change.timeOut !== undefined) body.timeOut = change.timeOut ? combine(day, change.timeOut) : null;
        await apiJson(`${base}/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify(body) });
      }
      if (newRow.date || newRow.timeIn || newRow.timeOut) {
        if (!newRow.date || !newRow.timeIn) throw new Error("Enter the date and time in for the new row.");
        await apiJson(base, {
          method: "POST",
          body: JSON.stringify({
            timeIn: combine(newRow.date, newRow.timeIn),
            timeOut: newRow.timeOut ? combine(newRow.date, newRow.timeOut) : null,
          }),
        });
      }
      setEdits({});
      setNewRow({ date: "", timeIn: "", timeOut: "" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to save");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const row = data?.rows.find((r) => r.id === selectedId);
    if (!row) return;
    if (!confirm(`Delete the time sheet row for ${formatDate(row.day)}? It will be listed on the audit report.`)) return;
    setBusy(true);
    setError("");
    try {
      await apiJson(`${base}/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setSelectedId(null);
      setEdits((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  function openReport() {
    const params = new URLSearchParams({ kind, id: currentId, from: range.from, to: range.to });
    window.open(`/time-sheets/report?${params}`, "_blank", "noopener");
    setReportOpen(false);
  }

  function openAudit() {
    window.open(`/time-sheets/audit?${new URLSearchParams({ kind, id: currentId })}`, "_blank", "noopener");
  }

  const labelHeading = kind === "child" ? "Classroom" : "Position";
  const title = kind === "child" ? "Child Time Sheet" : "Employee Time";
  const subjectOptions = useMemo(
    () => (subjects.some((s) => s.id === currentId) ? subjects : [{ id: currentId, name: data?.subject?.name || "" }, ...subjects]),
    [subjects, currentId, data?.subject?.name],
  );

  const cell = "px-3 py-2 text-sm text-blue-900 dark:text-blue-100";
  const input = "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
  const button =
    "inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50/60 px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 text-xl font-black text-blue-950 dark:text-white">
            <span aria-hidden="true">&#128339;</span> {title}
          </h2>
          <button type="button" onClick={close} className="rounded-md px-2 text-2xl text-gray-500 hover:text-gray-800" aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          {kind === "staff" && subjectOptions.length > 1 ? (
            <select
              value={currentId}
              onChange={(e) => {
                if (dirty && !confirm("Discard your unsaved changes?")) return;
                setCurrentId(e.target.value);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base font-bold text-blue-950 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              aria-label="Employee"
            >
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div className="text-lg font-bold text-blue-950 dark:text-white">{data?.subject?.name || " "}</div>
          )}
        </div>

        {error ? <div className="mx-5 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="sticky top-0 bg-sky-50 dark:bg-gray-800">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-blue-950 dark:text-gray-200">
                {[labelHeading, "Day", "Date In", "Time In", "By", "Date Out", "Time Out", "By"].map((h, i) => (
                  <th key={`${h}-${i}`} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : null}
              {data?.rows.map((row) => {
                const selected = row.id === selectedId;
                const pending = edits[row.id] || {};
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-t border-gray-100 dark:border-gray-800 ${selected ? "bg-sky-100/70 dark:bg-sky-900/40" : "hover:bg-gray-50 dark:hover:bg-gray-800/60"}`}
                    aria-selected={selected}
                  >
                    <td className={cell}>{row.label || "—"}</td>
                    <td className={cell}>{DAY_NAMES[new Date(row.day).getDay()]}</td>
                    <td className={cell}>{formatDate(row.day)}</td>
                    <td className={cell}>
                      {selected ? (
                        <input type="time" aria-label="Time in" className={input} value={pending.timeIn ?? toTimeInput(row.timeIn)} onChange={(e) => editRow(row, "timeIn", e.target.value)} />
                      ) : (
                        <span className={pending.timeIn !== undefined ? "font-bold text-amber-700" : ""}>{pending.timeIn ?? formatTime(row.timeIn)}</span>
                      )}
                    </td>
                    <td className={cell}>{row.inBy || ""}</td>
                    <td className={cell}>{row.timeOut ? formatDate(row.timeOut) : ""}</td>
                    <td className={cell}>
                      {selected ? (
                        <input type="time" aria-label="Time out" className={input} value={pending.timeOut ?? toTimeInput(row.timeOut)} onChange={(e) => editRow(row, "timeOut", e.target.value)} />
                      ) : (
                        <span className={pending.timeOut !== undefined ? "font-bold text-amber-700" : ""}>{pending.timeOut ?? formatTime(row.timeOut)}</span>
                      )}
                    </td>
                    <td className={cell}>{row.outBy || ""}</td>
                  </tr>
                );
              })}
              {data ? (
                <tr className="border-t border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40">
                  <td className={cell} colSpan={2}><span className="text-xs text-gray-500">Add a missing day</span></td>
                  <td className={cell}>
                    <input type="date" aria-label="New row date" className={input} value={newRow.date} max={toDateInput(new Date())} onChange={(e) => setNewRow({ ...newRow, date: e.target.value })} />
                  </td>
                  <td className={cell}>
                    <input type="time" aria-label="New row time in" className={input} value={newRow.timeIn} onChange={(e) => setNewRow({ ...newRow, timeIn: e.target.value })} />
                  </td>
                  <td />
                  <td className={cell}><span className="text-xs text-gray-500">{newRow.date ? formatDate(`${newRow.date}T12:00`) : ""}</span></td>
                  <td className={cell}>
                    <input type="time" aria-label="New row time out" className={input} value={newRow.timeOut} onChange={(e) => setNewRow({ ...newRow, timeOut: e.target.value })} />
                  </td>
                  <td />
                </tr>
              ) : null}
            </tbody>
          </table>
          {data && data.rows.length === 0 ? <p className="py-3 text-center text-sm text-gray-500">No time recorded yet.</p> : null}
        </div>

        {signatures.length ? (
          <div className="border-t border-gray-100 px-5 py-3 text-sm dark:border-gray-700">
            <span className="font-bold text-gray-900 dark:text-white">Signed time sheets: </span>
            {signatures.slice(0, 6).map((sig, i) => (
              <span key={sig.id}>
                {i ? ", " : ""}
                <a
                  href={`/time-sheets/report?${new URLSearchParams({ kind: "staff", id: currentId, from: sig.from, to: sig.to })}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                  title={`Signed ${new Date(sig.signedAt).toLocaleString()}`}
                >
                  {sig.from} – {sig.to}
                </a>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <div className="relative flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || !selectedId} onClick={deleteSelected}>
              <span className="text-red-600" aria-hidden="true">&#128465;</span> Delete
            </button>
            <button type="button" className={button} onClick={() => setReportOpen((v) => !v)} aria-expanded={reportOpen}>
              &#128196; Report &#9662;
            </button>
            <button type="button" className={button} onClick={openAudit}>&#128269; Audit</button>
            {reportOpen ? (
              <div className="absolute bottom-full left-24 z-10 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="text-sm font-bold text-gray-900 dark:text-white">Report date range</div>
                <label className="mt-2 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Start date
                  <input type="date" className={`${input} mt-1`} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                </label>
                <label className="mt-2 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                  End date
                  <input type="date" className={`${input} mt-1`} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
                  disabled={!range.from || !range.to || range.from > range.to}
                  onClick={openReport}
                >
                  Run report
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className={button} disabled={busy || !dirty} onClick={save}>
              &#128190; {busy ? "Saving..." : "Save"}
            </button>
            <button type="button" className={button} onClick={close}>&#10140; Exit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
