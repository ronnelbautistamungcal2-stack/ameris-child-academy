import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CurriculumTabs from "@/components/curriculum/CurriculumTabs";
import useCurriculumClassroom, { ClassroomPicker } from "@/components/curriculum/useCurriculumClassroom";
import { apiJson } from "@/lib/api";
import { rowLabel } from "@/lib/lessonPlanRows";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";
import { useCallback, useEffect, useMemo, useState } from "react";

// Lesson Planner (client mockup 2026-10-02): the Lesson Bank on the left, and
// a Day × category grid per classroom on the right. Lessons are dragged from
// the bank into a day; the Lesson Calendar decides which date each day falls
// on, and the teacher's Weekly Lesson Plan shows that day's lessons.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const VISIBLE_DAYS = 10;
const PAGE_SIZE = 20;
const DRAG_TYPE = "application/x-ameris-lesson";
const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

function termLabel(value) {
  const raw = String(value || "").trim();
  const n = raw.match(/^(?:term\s*)?(\d+)$/i);
  return n ? `Term ${n[1]}` : raw;
}

/** One bank entry per lesson, with the filters the bank offers. */
function bankEntries(lessons) {
  return lessons
    .map((lesson) => {
      const pc = lesson.goals?.[0]?.passingCriteria || {};
      return {
        id: lesson.id,
        title: String(pc.lesson || lesson.title || "").trim() || "Untitled lesson",
        term: termLabel(pc.term || lesson.term),
        age: String(pc.age || lesson.category?.ageRange || ""),
        category: String(pc.category || lesson.category?.name || ""),
        subject: normalizeSubjectForRef({ subject: String(pc.subject || lesson.subCategory || ""), refId: String(pc.reference || "") }),
        search: [lesson.id, lesson.title, lesson.description, pc.reference].filter(Boolean).join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function distinct(entries, key) {
  return [...new Set(entries.map((e) => e[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export default function LessonPlannerPage() {
  const picker = useCurriculumClassroom();
  const { centerId, classRoomId } = picker;
  const [lessons, setLessons] = useState([]);
  const [rows, setRows] = useState([]);
  const [planner, setPlanner] = useState({ theme: "", dayCount: 10, cells: [], usedLessonIds: [] });
  const [themeDraft, setThemeDraft] = useState("");
  const [firstDay, setFirstDay] = useState(1);
  const [jumpDay, setJumpDay] = useState("1");
  const [highlightDay, setHighlightDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteDay, setDeleteDay] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [typing, setTyping] = useState(null); // { day, rowIndex, text }
  const [editingRow, setEditingRow] = useState(null); // { rowIndex, text }
  const [dropTarget, setDropTarget] = useState("");

  const load = useCallback(async () => {
    if (!centerId || !classRoomId) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ centerId, classRoomId });
      const [rowData, plan] = await Promise.all([
        apiJson(`/api/v1/lesson-plan-rows?${q}`),
        apiJson(`/api/v1/lesson-planner?${q}`),
      ]);
      setRows(Array.isArray(rowData) ? rowData : []);
      setPlanner(plan);
      setThemeDraft(plan.theme || "");
      setFirstDay(1);
    } catch (e) {
      setError(e.message || "Could not load the lesson planner");
    } finally {
      setLoading(false);
    }
  }, [centerId, classRoomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}&kind=lesson`)
      .then((data) => setLessons(Array.isArray(data) ? data : []))
      .catch(() => setLessons([]));
  }, [centerId]);

  async function change(body) {
    setBusy(true);
    setError("");
    try {
      const plan = await apiJson("/api/v1/lesson-planner", {
        method: "PUT",
        body: JSON.stringify({ centerId, classRoomId, ...body }),
      });
      setPlanner(plan);
      return plan;
    } catch (e) {
      setError(e.message || "Could not save");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function changeRows(method, body) {
    setError("");
    try {
      await apiJson("/api/v1/lesson-plan-rows", { method, body: JSON.stringify({ centerId, classRoomId, ...body }) });
      const q = new URLSearchParams({ centerId, classRoomId });
      setRows(await apiJson(`/api/v1/lesson-plan-rows?${q}`));
    } catch (e) {
      setError(e.message || "Could not save the category");
    }
  }

  const cellAt = useMemo(() => {
    const map = {};
    for (const cell of planner.cells) map[`${cell.day}:${cell.rowIndex}`] = cell;
    return map;
  }, [planner.cells]);

  const bank = useMemo(() => bankEntries(lessons), [lessons]);
  const usedSet = useMemo(() => new Set(planner.usedLessonIds), [planner.usedLessonIds]);

  const lastFirstDay = Math.max(1, planner.dayCount - VISIBLE_DAYS + 1);
  const start = Math.min(firstDay, lastFirstDay);
  const days = Array.from({ length: Math.min(VISIBLE_DAYS, planner.dayCount) }, (_, i) => start + i);

  function jump() {
    const day = Number(jumpDay);
    if (!Number.isInteger(day) || day < 1 || day > planner.dayCount) {
      setError(`Choose a day from 1 to ${planner.dayCount}.`);
      return;
    }
    setError("");
    setFirstDay(Math.max(1, Math.min(day, lastFirstDay)));
    setHighlightDay(day);
  }

  function onDrop(e, day, rowIndex) {
    e.preventDefault();
    setDropTarget("");
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (payload?.type === "lesson") change({ action: "setCell", day, rowIndex, lessonId: payload.lessonId });
    if (payload?.type === "cell") change({ action: "moveCell", from: payload.from, to: { day, rowIndex } });
  }

  function dragData(e, payload) {
    const text = JSON.stringify(payload);
    e.dataTransfer.setData(DRAG_TYPE, text);
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.effectAllowed = "copyMove";
  }

  async function saveTheme() {
    if (themeDraft.trim() === (planner.theme || "")) return;
    const plan = await change({ action: "setTheme", theme: themeDraft });
    if (plan) setThemeDraft(plan.theme || "");
  }

  async function saveTyped() {
    const t = typing;
    setTyping(null);
    if (t && t.text.trim()) await change({ action: "setCell", day: t.day, rowIndex: t.rowIndex, title: t.text });
  }

  async function saveRowLabel() {
    const r = editingRow;
    setEditingRow(null);
    if (!r) return;
    const row = rows.find((x) => x.rowIndex === r.rowIndex);
    if (r.text.trim() && r.text.trim() !== rowLabel(row)) await changeRows("PUT", { rowIndex: r.rowIndex, label: r.text.trim() });
  }

  return (
    <AdminLayout title="Curriculum">
      <div className="space-y-4">
        <h1 className={`text-3xl font-black ${NAVY}`}>Lesson Planner</h1>
        <CurriculumTabs active="planner" />

        {(error || picker.error) && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error || picker.error}</div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <LessonBank
            entries={bank}
            used={usedSet}
            onToggleUsed={(lessonId, used) => change({ action: "markUsed", lessonId, used })}
            onDragStart={(e, entry) => dragData(e, { type: "lesson", lessonId: entry.id })}
            disabled={!classRoomId}
          />

          <section className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className={`text-2xl font-black ${NAVY}`}>{"\u{1F4CB}"} Lesson Planner</h2>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <ClassroomPicker picker={picker} />
                <label className={`text-xs font-semibold ${NAVY}`}>
                  Theme
                  <input
                    value={themeDraft}
                    onChange={(e) => setThemeDraft(e.target.value)}
                    onBlur={saveTheme}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    placeholder="Type a theme, e.g. Fall"
                    maxLength={120}
                    disabled={!classRoomId}
                    className={`${input} mt-1 block w-52`}
                  />
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className={`flex items-center gap-2 text-sm font-semibold ${NAVY}`}>
                  Jump to Day:
                  <input
                    type="number"
                    min="1"
                    max={planner.dayCount}
                    value={jumpDay}
                    onChange={(e) => setJumpDay(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && jump()}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    aria-label="Jump to day number"
                  />
                </label>
                <button type="button" onClick={jump} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
                  Go
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className={`w-full min-w-[1080px] table-fixed border-collapse text-xs ${loading || busy ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[120px] p-1">
                      <button
                        type="button"
                        onClick={() => setFirstDay(Math.max(1, start - VISIBLE_DAYS))}
                        disabled={start <= 1}
                        aria-label="Earlier days"
                        className="rounded border border-gray-300 px-2 py-1 text-base font-bold text-[#0b2a5b] disabled:opacity-30 dark:border-gray-600 dark:text-blue-100"
                      >
                        {"‹"}
                      </button>
                    </th>
                    {days.map((day) => (
                      <th key={day} className={`group/day relative whitespace-nowrap border border-gray-200 bg-blue-50 px-1 py-2 text-center text-sm font-bold normal-case dark:border-gray-700 dark:bg-gray-800 ${NAVY} ${highlightDay === day ? "ring-2 ring-inset ring-blue-600" : ""}`}>
                        <div className="flex items-center justify-center">
                          Day {day}
                          <button
                            type="button"
                            onClick={() => setDeleteDay(day)}
                            disabled={planner.dayCount <= 1}
                            aria-label={`Delete Day ${day}`}
                            title={`Delete Day ${day}`}
                            className="absolute right-0.5 top-0.5 rounded px-1 text-xs text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover/day:opacity-100 disabled:hidden"
                          >
                            &times;
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="w-[92px] p-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFirstDay(Math.min(lastFirstDay, start + VISIBLE_DAYS))}
                          disabled={start >= lastFirstDay}
                          aria-label="Later days"
                          className="rounded border border-gray-300 px-2 py-1 text-base font-bold text-[#0b2a5b] disabled:opacity-30 dark:border-gray-600 dark:text-blue-100"
                        >
                          {"›"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const plan = await change({ action: "addDay" });
                            if (plan) setFirstDay(Math.max(1, plan.dayCount - VISIBLE_DAYS + 1));
                          }}
                          disabled={!classRoomId || busy}
                          title="Add a day column"
                          className="rounded border border-blue-600 px-1.5 py-1 font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300"
                        >
                          + Day
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowIndex}>
                      <th scope="row" className={`group border border-gray-200 bg-blue-50/70 px-2 py-2 text-left text-sm font-bold dark:border-gray-700 dark:bg-gray-800 ${NAVY}`}>
                        {editingRow?.rowIndex === row.rowIndex ? (
                          <input
                            autoFocus
                            value={editingRow.text}
                            onChange={(e) => setEditingRow({ ...editingRow, text: e.target.value })}
                            onBlur={saveRowLabel}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingRow(null);
                            }}
                            maxLength={80}
                            aria-label="Category name"
                            className="w-full rounded border border-blue-400 px-1 py-0.5 text-sm"
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-1">
                            <button type="button" onClick={() => setEditingRow({ rowIndex: row.rowIndex, text: rowLabel(row) })} title="Rename category" className="text-left hover:underline">
                              {rowLabel(row)}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteRow(row)}
                              aria-label={`Delete category ${rowLabel(row)}`}
                              className="text-gray-400 opacity-0 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </th>
                      {days.map((day) => {
                        const key = `${day}:${row.rowIndex}`;
                        const cell = cellAt[key];
                        const isTyping = typing?.day === day && typing?.rowIndex === row.rowIndex;
                        return (
                          <td
                            key={day}
                            data-cell={key}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDropTarget(key);
                            }}
                            onDragLeave={() => setDropTarget((t) => (t === key ? "" : t))}
                            onDrop={(e) => onDrop(e, day, row.rowIndex)}
                            className={`h-14 border border-gray-200 p-1 align-middle dark:border-gray-700 ${dropTarget === key ? "bg-blue-100 dark:bg-blue-900/40" : ""}`}
                          >
                            {cell ? (
                              <div
                                draggable
                                onDragStart={(e) => dragData(e, { type: "cell", from: { day, rowIndex: row.rowIndex } })}
                                className="group/cell flex h-full cursor-grab items-center gap-1 rounded px-1 text-[#0b2a5b] hover:bg-blue-50 dark:text-blue-100 dark:hover:bg-gray-800"
                                title={cell.title}
                              >
                                <span aria-hidden className="text-gray-400">{"⋮"}</span>
                                <span className="line-clamp-3 flex-1 text-center leading-tight">{cell.title}</span>
                                <button
                                  type="button"
                                  onClick={() => change({ action: "setCell", day, rowIndex: row.rowIndex, title: "" })}
                                  aria-label={`Remove ${cell.title} from Day ${day}`}
                                  className="text-gray-400 opacity-0 hover:text-red-600 group-hover/cell:opacity-100 focus:opacity-100"
                                >
                                  &times;
                                </button>
                              </div>
                            ) : isTyping ? (
                              <input
                                autoFocus
                                value={typing.text}
                                onChange={(e) => setTyping({ ...typing, text: e.target.value })}
                                onBlur={saveTyped}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setTyping(null);
                                }}
                                maxLength={200}
                                placeholder="Type a lesson"
                                aria-label={`Lesson for ${rowLabel(row)}, Day ${day}`}
                                className="w-full rounded border border-blue-400 px-1 py-1 text-xs"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTyping({ day, rowIndex: row.rowIndex, text: "" })}
                                disabled={!classRoomId}
                                aria-label={`Add a lesson to ${rowLabel(row)}, Day ${day}`}
                                className="flex h-full w-full items-center justify-center text-base text-gray-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-gray-800"
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => changeRows("POST", { label: "New Category" })}
              disabled={!classRoomId}
              className="mt-3 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300"
            >
              + Add Category
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Drag lessons from the Lesson Bank into a day, or click + to type one. Drag a lesson to move it. Click a category to rename it.
            </p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDay !== null}
        title={`Delete Day ${deleteDay}?`}
        message={`The lessons on Day ${deleteDay} are removed, and every later day moves back one (Day ${(deleteDay || 0) + 1} becomes Day ${deleteDay}).`}
        confirmLabel="Delete Day"
        variant="danger"
        onConfirm={() => {
          const day = deleteDay;
          setDeleteDay(null);
          change({ action: "deleteDay", day });
        }}
        onCancel={() => setDeleteDay(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteRow)}
        title="Delete category?"
        message={deleteRow ? `Remove "${rowLabel(deleteRow)}" from this classroom's planner and Weekly Lesson Plan?` : ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          const row = deleteRow;
          setDeleteRow(null);
          changeRows("DELETE", { rowIndex: row.rowIndex });
        }}
        onCancel={() => setDeleteRow(null)}
      />
    </AdminLayout>
  );
}

function LessonBank({ entries, used, onToggleUsed, onDragStart, disabled }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ term: "", age: "", category: "", subject: "" });
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);

  const options = useMemo(
    () => ({ term: distinct(entries, "term"), age: distinct(entries, "age"), category: distinct(entries, "category"), subject: distinct(entries, "subject") }),
    [entries],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = entries.filter(
      (e) =>
        (!q || e.title.toLowerCase().includes(q) || e.search.includes(q)) &&
        Object.entries(filters).every(([key, value]) => !value || e[key] === value),
    );
    return descending ? list.reverse() : list;
  }, [entries, search, filters, descending]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filter = (key, label, all) => (
    <label className={`text-xs font-semibold ${NAVY}`}>
      {label}
      <select
        className={`${input} mt-1 px-2 py-1.5 text-xs`}
        value={filters[key]}
        onChange={(e) => {
          setFilters({ ...filters, [key]: e.target.value });
          setPage(1);
        }}
      >
        <option value="">{all}</option>
        {options[key].map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <aside className="w-full shrink-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 xl:w-[300px]">
      <h2 className={`text-2xl font-black ${NAVY}`}>{"\u{1F4D8}"} Lesson Bank</h2>
      <p className={`text-sm ${NAVY}`}>All available lessons</p>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search lesson title, description, or ID..."
        aria-label="Search lessons"
        className={`${input} mt-3`}
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {filter("term", "Term", "All Terms")}
        {filter("age", "Age", "All Ages")}
        {filter("category", "Category", "All Categories")}
      </div>
      <div className="mt-2">{filter("subject", "Subject", "All Subjects")}</div>

      <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setDescending((d) => !d)}
          className={`flex w-full items-center justify-center gap-1 bg-blue-50 py-1.5 text-xs font-bold dark:bg-gray-800 ${NAVY}`}
        >
          Lesson Title {descending ? "▼" : "▲"}
        </button>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {shown.map((entry) => {
            const isUsed = used.has(entry.id);
            return (
              <li
                key={entry.id}
                draggable={!disabled}
                onDragStart={(e) => onDragStart(e, entry)}
                className="flex cursor-grab items-center gap-2 px-2 py-1.5 text-sm text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-gray-800"
                title={[entry.term, entry.age, entry.category, entry.subject].filter(Boolean).join(" · ")}
              >
                <span aria-hidden className="text-gray-400">{"∷"}</span>
                <span className="flex-1 truncate">{entry.title}</span>
                <button
                  type="button"
                  onClick={() => onToggleUsed(entry.id, !isUsed)}
                  disabled={disabled}
                  aria-pressed={isUsed}
                  aria-label={isUsed ? `Unmark ${entry.title} as used` : `Mark ${entry.title} as used`}
                  title={isUsed ? "Used — click to unmark" : "Mark as used"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    isUsed ? "bg-green-600 text-white" : "border border-gray-300 text-transparent hover:border-green-600 hover:text-green-600"
                  }`}
                >
                  {"✓"}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-2 py-4 text-center text-xs text-gray-500">No lessons match.</li>}
        </ul>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          Showing {visible.length ? (current - 1) * PAGE_SIZE + 1 : 0}-{Math.min(current * PAGE_SIZE, visible.length)} of {visible.length}
        </span>
        <span className="flex gap-1">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current <= 1} className="rounded border px-2 disabled:opacity-30" aria-label="Previous page">
            {"‹"}
          </button>
          <span className="px-1 font-semibold">{current} / {pages}</span>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages} className="rounded border px-2 disabled:opacity-30" aria-label="Next page">
            {"›"}
          </button>
        </span>
      </div>
    </aside>
  );
}
