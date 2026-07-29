import TeacherLayout from "@/components/teacher/TeacherLayout";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { collectChecklistLessonAttachments } from "@/lib/checklistLessonResources";
import { getChecklistClassRooms } from "@/lib/dailyChecklistClassrooms";
import {
  describeChecklistSchedule,
  getEffectiveItemSchedule,
  summarizeChecklistFrequency,
  summarizeChecklistSchedule,
} from "@/lib/checklistSchedule";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORY_LABELS = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HEALTH_SAFETY: "Health & Safety",
  CLEANING: "Cleaning",
  MEALS: "Meals",
  CLASSROOM: "Classroom",
  OTHER: "Other",
};

const CATEGORY_BORDER = {
  OPENING: "border-l-amber-400",
  CLOSING: "border-l-indigo-400",
  HEALTH_SAFETY: "border-l-rose-400",
  CLEANING: "border-l-emerald-400",
  MEALS: "border-l-orange-400",
  CLASSROOM: "border-l-sky-400",
  OTHER: "border-l-gray-400",
};

const FREQUENCY_COLORS = {
  DAILY: "bg-sky-50 text-sky-700",
  WEEKLY: "bg-violet-50 text-violet-700",
  MONTHLY: "bg-amber-50 text-amber-700",
  ONE_TIME: "bg-rose-50 text-rose-700",
  MIXED: "bg-slate-100 text-slate-700",
};

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const left = a.taskTime || "99:99";
    const right = b.taskTime || "99:99";
    if (left !== right) return left.localeCompare(right);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function itemHasLinkedResources(item) {
  return !!(
    item?.lesson ||
    item?.lessonGoal ||
    item?.policyDocument ||
    item?.directLink ||
    item?.policyLink ||
    item?.mediaLink
  );
}

function completionKey(item) {
  return `${item?.source || "ROUTINE"}:${item?.id || ""}`;
}

function buildNoteDrafts(checklists, previousDrafts = {}, replaceDraftId = "") {
  const next = {};
  for (const checklist of Array.isArray(checklists) ? checklists : []) {
    const ownNote = (checklist.notes || []).find((note) => note.mine);
    const serverValue = ownNote?.notes || "";
    if (replaceDraftId && checklist.id === replaceDraftId) {
      next[checklist.id] = serverValue;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(previousDrafts, checklist.id)) {
      next[checklist.id] = previousDrafts[checklist.id];
      continue;
    }
    next[checklist.id] = serverValue;
  }
  return next;
}

export default function TeacherChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classrooms, setClassrooms] = useState([]);
  const [classId, setClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(rows) ? rows : [];
        setCenters(nextCenters);
        if (nextCenters.length === 1) setCenterId(nextCenters[0].id);
      } catch (nextError) {
        setError(nextError.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setClassrooms([]);
      setClassId("");
      return;
    }
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setClassrooms(arr);
        if (arr.length === 1) setClassId(arr[0].id);
      })
      .catch(() => setClassrooms([]));
  }, [centerId]);

  return (
    <TeacherLayout title="Checklists">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Checklists</h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Complete daily tasks on the left. The weekly lesson plan assigned by admin appears on the right.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:max-w-xl md:grid-cols-3">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={centerId}
                onChange={(event) => setCenterId(event.target.value)}
                disabled={loading}
              >
                <option value="">Select a center...</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Class</div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                disabled={!centerId}
              >
                <option value="">Select a class...</option>
                {classrooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Current day</div>
              <input
                type="date"
                value={selectedDate}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                disabled
                readOnly
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {!centerId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Select a center to view the assigned checklist for that day.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Daily task checklist */}
            <TeacherDailyChecklist centerId={centerId} classId={classId} selectedDate={selectedDate} />
            {/* Weekly lesson plan (read-only, admin-assigned) — full width so the whole week is visible without scrolling */}
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <h3 className="text-sm font-extrabold text-gray-900">Weekly Lesson Plan</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Lessons assigned by admin for this week. Click any lesson to view its attachment.
                </p>
              </div>
              {!classId ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
                  Select a class above to see the weekly lesson plan.
                </div>
              ) : (
                <>
                  <WeeklyLessonPlanner centerId={centerId} classId={classId} mode="teacher" />
                  <NextWeekSupplies centerId={centerId} classRoomId={classId} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

function TeacherDailyChecklist({ centerId, classId, selectedDate }) {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteId, setSavingNoteId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);

  async function load(options = {}) {
    const replaceDraftId = options.replaceDraftId || "";
    const resetDrafts = options.resetDrafts === true;

    setLoading(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/daily-checklists?centerId=${encodeURIComponent(
          centerId,
        )}&date=${encodeURIComponent(selectedDate)}`,
      );
      const allRows = Array.isArray(data) ? data : [];
      const rows = classId
        ? allRows.filter((checklist) => {
            const rooms = getChecklistClassRooms(checklist);
            return !rooms.length || rooms.some((room) => room.id === classId);
          })
        : allRows;
      setChecklists(rows);
      setNoteDrafts((previousDrafts) =>
        buildNoteDrafts(rows, resetDrafts ? {} : previousDrafts, replaceDraftId),
      );
    } catch (nextError) {
      setError(nextError.message || "Failed to load checklist");
      setChecklists([]);
      setNoteDrafts({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ resetDrafts: true });
    setSelectedDetail(null);
  }, [centerId, classId, selectedDate]);

  async function toggleItem(item, isCompleted) {
    setCompleting(completionKey(item));
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists/complete", {
        method: "POST",
        body: JSON.stringify({
          itemId: item.id,
          source: item.source || "ROUTINE",
          date: selectedDate,
          undo: isCompleted,
        }),
      });
      await load();
    } catch (nextError) {
      setError(nextError.message || "Failed to update checklist item");
    } finally {
      setCompleting("");
    }
  }

  async function saveChecklistNote(checklistId) {
    setSavingNoteId(checklistId);
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists/notes", {
        method: "POST",
        body: JSON.stringify({
          checklistId,
          date: selectedDate,
          notes: noteDrafts[checklistId] || "",
        }),
      });
      await load({ replaceDraftId: checklistId });
    } catch (nextError) {
      setError(nextError.message || "Failed to save checklist note");
    } finally {
      setSavingNoteId("");
    }
  }

  const totals = useMemo(() => {
    const totalItems = checklists.reduce(
      (sum, checklist) => sum + (checklist.items?.length || 0),
      0,
    );
    const completedItems = checklists.reduce(
      (sum, checklist) =>
        sum +
        (checklist.items || []).filter((item) => (item.completions || []).length > 0)
          .length,
      0,
    );
    return {
      totalItems,
      completedItems,
      percent:
        totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  }, [checklists]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {totals.totalItems > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Day Progress</span>
            <span className="font-extrabold text-gray-900">
              {totals.completedItems}/{totals.totalItems} ({totals.percent}%)
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                totals.percent === 100 ? "bg-emerald-500" : "bg-sky-500"
              }`}
              style={{ width: `${totals.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <Skeleton count={5} />
        </div>
      ) : checklists.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No checklists are assigned to this center for the selected date.
        </div>
      ) : (
        checklists.map((checklist) => {
          const items = sortByTaskTime(checklist.items);
          const completedCount = items.filter(
            (item) => (item.completions || []).length > 0,
          ).length;
          const allDone = items.length > 0 && completedCount === items.length;
          const notes = Array.isArray(checklist.notes) ? checklist.notes : [];
          const ownNote = notes.find((note) => note.mine);
          const noteDraft = noteDrafts[checklist.id] || "";
          const scheduleKey = summarizeChecklistFrequency(checklist);
          const scheduleLabel =
            checklist.scheduleLabel || summarizeChecklistSchedule(checklist);
          const canSaveNotes = checklist.source !== "SCHEDULED_LESSON_PLAN";
          const checklistRooms = getChecklistClassRooms(checklist);

          return (
            <div
              key={checklist.id}
              className={`rounded-xl border-l-4 border border-gray-200 bg-white ${
                CATEGORY_BORDER[checklist.category] || "border-l-gray-400"
              }`}
            >
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-gray-900">
                    {checklist.title}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    {CATEGORY_LABELS[checklist.category] || checklist.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      FREQUENCY_COLORS[scheduleKey] || ""
                    }`}
                  >
                    {scheduleLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {completedCount}/{items.length} complete
                  </span>
                  {checklistRooms.slice(0, 2).map((room) => (
                    <span
                      key={room.id}
                      className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                    >
                      {room.name}
                    </span>
                  ))}
                  {checklistRooms.length > 2 ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      +{checklistRooms.length - 2} more classrooms
                    </span>
                  ) : null}
                  {allDone ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Finished
                    </span>
                  ) : null}
                </div>
                {checklist.description ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {checklist.description}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-gray-100 px-4 pb-4">
                <div className="divide-y divide-gray-50">
                  {[...items].sort((a, b) => {
                    const aDone = (a.completions || []).length > 0 ? 1 : 0;
                    const bDone = (b.completions || []).length > 0 ? 1 : 0;
                    return aDone - bDone;
                  }).map((item) => {
                    const completion = (item.completions || [])[0];
                    const isDone = !!completion;
                    const busy = completing === completionKey(item);
                    const hasResources = itemHasLinkedResources(item);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 py-3 ${
                          isDone ? "opacity-60" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleItem(item, isDone)}
                          disabled={busy}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-gray-300 bg-white hover:border-sky-400"
                          } ${busy ? "animate-pulse" : ""}`}
                          aria-label={
                            isDone
                              ? `Mark ${item.title} incomplete`
                              : `Mark ${item.title} complete`
                          }
                        >
                          {isDone ? (
                            <svg
                              className="h-3 w-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : null}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDetail({ checklist, item, completion })
                          }
                          className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left hover:bg-gray-50"
                        >
                          {item.taskTime ? (
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-600">
                              {formatTaskTime(item.taskTime)}
                            </div>
                          ) : null}
                          <div
                            className={`text-sm font-medium ${
                              isDone
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            {item.title}
                          </div>
                          {item.description ? (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {item.description}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {hasResources ? (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                View linked details
                              </span>
                            ) : null}
                            {item.lessonSource === "AUTO_SLOT" && item.lessonSlot ? (
                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                Auto slot: {item.lessonSlot}
                              </span>
                            ) : null}
                            {item.lesson ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Lesson
                              </span>
                            ) : null}
                            {item.source === "SCHEDULED_LESSON" ? (
                              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                Scheduled
                              </span>
                            ) : null}
                            {item.policyDocument ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Policy
                              </span>
                            ) : null}
                            {item.directLink ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Link
                              </span>
                            ) : null}
                            {item.mediaLink ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Video
                              </span>
                            ) : null}
                          </div>
                          {completion ? (
                            <div className="mt-1 text-[10px] text-emerald-700">
                              Completed by{" "}
                              {completion.completedBy?.name ||
                                completion.completedBy?.email ||
                                "Staff"}{" "}
                              at{" "}
                              {new Date(completion.completedAt).toLocaleTimeString(
                                "en-US",
                                { hour: "numeric", minute: "2-digit" },
                              )}
                            </div>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {canSaveNotes ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                          Checklist Notes
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          Save notes for this checklist and selected date.
                        </div>
                      </div>
                      {ownNote?.updatedAt ? (
                        <div className="text-[11px] text-gray-500">
                          Last saved {formatDateTime(ownNote.updatedAt)}
                        </div>
                      ) : null}
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [checklist.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Add any notes teachers should keep with this checklist..."
                      className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-gray-500">
                        Clear the text and save again to remove your note.
                      </div>
                      <button
                        type="button"
                        onClick={() => saveChecklistNote(checklist.id)}
                        disabled={savingNoteId === checklist.id}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingNoteId === checklist.id ? "Saving..." : "Save Note"}
                      </button>
                    </div>

                    {notes.length ? (
                      <div className="mt-3 grid gap-2">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              note.mine
                                ? "border-sky-200 bg-sky-50 text-sky-900"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                {note.mine
                                  ? "Your note"
                                  : note.createdBy?.name ||
                                    note.createdBy?.email ||
                                    "Staff note"}
                              </span>
                              <span className="text-[10px] opacity-75">
                                {formatDateTime(note.updatedAt || note.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{note.notes}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      <ChecklistItemDetailModal
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
      />
    </div>
  );
}

function ChecklistItemDetailModal({ detail, onClose }) {
  if (!detail?.item || !detail?.checklist) return null;

  const { checklist, item, completion } = detail;
  const lesson = item.lesson || null;
  const policy = item.policyDocument || null;
  const goalCount = Array.isArray(lesson?.goals) ? lesson.goals.length : 0;
  const lessonAttachments = collectChecklistLessonAttachments(
    lesson,
    item.lessonGoal,
  );
  const itemSchedule = getEffectiveItemSchedule(item, checklist);
  const detailScheduleLabel =
    item.source === "SCHEDULED_LESSON"
      ? checklist.scheduleLabel || "Scheduled today"
      : describeChecklistSchedule(itemSchedule);
  const hasLinkedResources =
    lessonAttachments.length > 0 ||
    !!policy?.url ||
    !!item.directLink ||
    !!item.policyLink ||
    !!item.mediaLink;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {checklist.title}
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-gray-900">
              {item.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                {CATEGORY_LABELS[checklist.category] || checklist.category}
              </span>
              <span>{detailScheduleLabel}</span>
              {item.taskTime ? <span>{formatTaskTime(item.taskTime)}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {item.description ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Item Details
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.description}</p>
            </div>
          ) : null}

          {completion ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Completed by{" "}
              <span className="font-semibold">
                {completion.completedBy?.name ||
                  completion.completedBy?.email ||
                  "Staff"}
              </span>{" "}
              at {formatDateTime(completion.completedAt)}.
            </div>
          ) : null}

          {lesson ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Linked Lesson
              </div>
              <div className="mt-2 text-base font-bold text-gray-900">
                {lesson.title}
              </div>
              {lesson.category?.name || lesson.term || lesson.reference ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                  {lesson.category?.name ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {lesson.category.name}
                    </span>
                  ) : null}
                  {lesson.term ? <span>Term: {lesson.term}</span> : null}
                  {lesson.reference ? (
                    <span>Reference: {lesson.reference}</span>
                  ) : null}
                </div>
              ) : null}
              {lesson.description ? (
                <p className="mt-3 text-sm text-gray-700">{lesson.description}</p>
              ) : null}
              {goalCount ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-600">
                    Progression steps
                  </div>
                  <div className="mt-2 grid gap-2">
                    {lesson.goals.map((goal) => (
                      <div
                        key={goal.id || `${lesson.id}:${goal.goalIndex}`}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          Step {goal.goalIndex}: {goal.title}
                        </div>
                        {goal.description ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {goal.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : item.lessonSource === "AUTO_SLOT" && item.lessonSlot ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Auto Lesson Slot
              </div>
              <div className="mt-2 text-sm font-semibold text-indigo-900">
                {item.lessonSlot}
              </div>
              <p className="mt-1 text-xs text-indigo-800">
                No lesson matched this slot for the current term day yet.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Linked Resources
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {lessonAttachments.map((attachment) => (
                <a
                  key={attachment.href}
                  href={attachment.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open attachment: {attachment.label}
                </a>
              ))}
              {policy?.url ? (
                <a
                  href={policy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open Policy: {policy.title || "Policy"}
                </a>
              ) : null}
              {item.directLink ? (
                <a
                  href={item.directLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {item.directLinkLabel || "Open linked resource"}
                </a>
              ) : null}
              {item.policyLink ? (
                <a
                  href={item.policyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open reference link
                </a>
              ) : null}
              {item.mediaLink ? (
                <a
                  href={item.mediaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open training video
                </a>
              ) : null}
              {!hasLinkedResources ? (
                <div className="text-sm text-gray-500">
                  No linked files, policy links, or reference material has been
                  added to this item yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NextWeekSupplies({ centerId, classRoomId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState({});
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!centerId || !classRoomId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ centerId, classRoomId });
      const result = await apiJson(`/api/v1/lessons/next-week-supplies?${qs}`);
      setData(result);
      setChecked({});
    } catch (e) {
      setError(e.message || "Failed to load next week's supplies");
    } finally {
      setLoading(false);
    }
  }, [centerId, classRoomId]);

  useEffect(() => { load(); }, [load]);

  const weekLabel = useMemo(() => {
    if (!data?.weekStart || !data?.weekEnd) return "Next Week";
    const start = new Date(data.weekStart + "T00:00:00");
    const end = new Date(data.weekEnd + "T00:00:00");
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [data]);

  const supplies = data?.supplies || [];
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">
            Supplies Needed for {weekLabel}
          </h3>
          {supplies.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              {checkedCount}/{supplies.length} items marked as have
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-2">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
          ) : loading ? (
            <div className="text-xs text-gray-500 py-2">Loading supplies…</div>
          ) : supplies.length === 0 ? (
            <div className="text-xs text-gray-500 py-2">
              No supplies are attached to lessons planned for next week. Supplies are added by admins inside each lesson.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-3 text-left text-xs font-semibold text-gray-500 w-10">Have?</th>
                  <th className="py-2 pr-3 text-left text-xs font-semibold text-gray-500">Supply</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Needed For</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((s, idx) => {
                  const key = `${s.name}|${s.unit || ""}`;
                  const isChecked = checked[key] || false;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-50 ${isChecked ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="h-4 w-4 rounded accent-emerald-600"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`font-semibold ${isChecked ? "line-through text-gray-400" : "text-amber-700"}`}>
                          {s.name}
                          {s.unit ? ` (${s.unit})` : ""}
                          {s.totalQuantity > 1 ? ` ×${s.totalQuantity}` : ""}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-600">
                        {s.lessons.map((l, i) => (
                          <span key={l.id}>
                            {l.title}
                            {i < s.lessons.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button
            type="button"
            onClick={load}
            className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
