import AdditionalSupplyRequest from "@/components/checklists/AdditionalSupplyRequest";
import ChecklistItemDetailModal from "@/components/checklists/ChecklistItemDetailModal";
import { ChecklistIcon } from "@/components/checklists/ChecklistManagerPage";
import KitchenShoppingList from "@/components/checklists/KitchenShoppingList";
import NextWeekSupplies from "@/components/checklists/NextWeekSupplies";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import { NAVY } from "@/components/reports/reportUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { LOG_FIRST_MESSAGE, checklistItemHref } from "@/lib/checklistLinks";
import { collectChecklistLessonAttachments } from "@/lib/checklistLessonResources";
import { formatDayKey, formatTaskTime, shiftDayKey, sortByTaskTime, todayKey } from "@/lib/checklistTime";
import { getChecklistClassRooms } from "@/lib/dailyChecklistClassrooms";
import { roleLabel, STAFF_PORTAL_ROLES } from "@/lib/roles";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// The Daily Checklist page every role fills out (client request 2026-10-02):
//  - teacher: picks which assigned checklist they fill out today (only that
//    one counts toward their grade), with the weekly lesson plan and supplies;
//  - staff (other staff, HR, student support, kitchen): every checklist
//    assigned to them for the chosen department/role; kitchen staff also see
//    next week's shopping list;
//  - personal (coach, admin): the checklists assigned to them by name.

const selectClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const card = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";

function hasLinkedDetails(item) {
  return (
    !!item.lesson ||
    !!item.policyDocument?.url ||
    !!item.policyLink ||
    !!item.mediaLink ||
    collectChecklistLessonAttachments(item.lesson, item.lessonGoal).length > 0
  );
}

export default function DailyChecklistWorkspace({ Layout, mode = "staff", title = "Checklist" }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || "";
  const staffRoles = useMemo(() => {
    const roles = [session?.user?.role, ...(session?.user?.roles || [])].filter((r) => STAFF_PORTAL_ROLES.includes(r));
    return [...new Set(roles)];
  }, [session]);

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [role, setRole] = useState("");
  const [date, setDate] = useState(todayKey());
  const [checklists, setChecklists] = useState([]);
  const [choiceId, setChoiceId] = useState("");
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [detail, setDetail] = useState(null);

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

  useEffect(() => {
    if (mode !== "staff" || !staffRoles.length) return;
    setRole((current) => (staffRoles.includes(current) ? current : staffRoles.includes(session?.user?.role) ? session.user.role : staffRoles[0]));
  }, [mode, staffRoles, session]);

  useEffect(() => {
    if (mode !== "teacher" || !centerId) return;
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((rows) => setClasses(Array.isArray(rows) ? rows : []))
      .catch(() => setClasses([]));
  }, [mode, centerId]);

  const ready = status !== "loading" && !!userId && !!centerId && (mode !== "staff" || !!role || !staffRoles.length);

  const load = useCallback(
    async ({ keepDrafts = false } = {}) => {
      if (!ready) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ centerId, date });
        if (mode !== "teacher") params.set("staffUserId", userId);
        if (mode === "staff" && role) params.set("asRole", role);
        const [rows, choice] = await Promise.all([
          apiJson(`/api/v1/daily-checklists?${params.toString()}`),
          mode === "teacher" ? apiJson(`/api/v1/daily-checklists/choice?date=${date}`) : Promise.resolve(null),
        ]);
        const list = Array.isArray(rows) ? rows : [];
        setChecklists(list);
        if (mode === "teacher") {
          const routine = list.filter((c) => c.source !== "SCHEDULED_LESSON_PLAN");
          setChoiceId((current) => {
            if (choice?.checklistId && routine.some((c) => c.id === choice.checklistId)) return choice.checklistId;
            if (routine.some((c) => c.id === current)) return current;
            return routine[0]?.id || "";
          });
        }
        if (!keepDrafts) {
          setNoteDrafts(
            Object.fromEntries(list.map((c) => [c.id, (c.notes || []).find((n) => n.mine)?.notes || ""])),
          );
        }
      } catch (e) {
        setError(e.message || "Failed to load the checklist");
        setChecklists([]);
      } finally {
        setLoading(false);
      }
    },
    [ready, centerId, date, mode, role, userId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const routineLists = checklists.filter((c) => c.source !== "SCHEDULED_LESSON_PLAN");
  const scheduledLists = checklists.filter((c) => c.source === "SCHEDULED_LESSON_PLAN");
  const shown = mode === "teacher" ? routineLists.filter((c) => c.id === choiceId) : routineLists;
  const isToday = date === todayKey();
  const canComplete = mode === "personal" || isToday;

  const isDone = (item) => (item.completions || []).some((c) => (c.completedById || c.completedBy?.id) === userId);
  const progress = useMemo(() => {
    const items = shown.flatMap((c) => c.items || []);
    const done = items.filter(isDone).length;
    return { done, total: items.length, pct: items.length ? Math.round((done * 100) / items.length) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, userId]);

  async function chooseChecklist(id) {
    setChoiceId(id);
    if (!isToday) return;
    try {
      await apiJson("/api/v1/daily-checklists/choice", { method: "PUT", body: JSON.stringify({ date, checklistId: id }) });
    } catch (e) {
      setError(e.message || "Failed to save your checklist choice");
    }
  }

  async function toggle(item) {
    setBusyItem(item.id);
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists/complete", {
        method: "POST",
        body: JSON.stringify({ itemId: item.id, source: item.source || "ROUTINE", date, undo: isDone(item) }),
      });
      await load({ keepDrafts: true });
    } catch (e) {
      setError(e.message || "Failed to update the item");
    } finally {
      setBusyItem("");
    }
  }

  async function saveNotes() {
    setSavingNote(true);
    setError("");
    try {
      for (const checklist of shown) {
        await apiJson("/api/v1/daily-checklists/notes", {
          method: "POST",
          body: JSON.stringify({ checklistId: checklist.id, date, notes: noteDrafts[checklist.id] || "" }),
        });
      }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (e) {
      setError(e.message || "Failed to save the note");
    } finally {
      setSavingNote(false);
    }
  }

  const selected = shown[0] || null;
  const teacherClassId = mode === "teacher" ? getChecklistClassRooms(selected || {})[0]?.id || classes[0]?.id || "" : "";
  const headingLabel =
    mode === "staff" ? session?.user?.staffDepartment || roleLabel(role) : mode === "personal" ? roleLabel(session?.user?.role) : "";
  const isKitchen = mode === "staff" && role === "KITCHEN_STAFF";
  const sidePanel = mode === "teacher" || mode === "staff";

  return (
    <Layout title={title}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ChecklistIcon />
          <h1 className={`text-3xl font-black ${NAVY}`}>Daily Checklist</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-56">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={selectClass} aria-label="Center">
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {mode === "teacher" ? (
            <label className="block w-64">
              <span className={`text-sm font-bold ${NAVY}`}>Checklist</span>
              <select value={choiceId} onChange={(e) => chooseChecklist(e.target.value)} className={selectClass} aria-label="Checklist" disabled={!routineLists.length}>
                {!routineLists.length ? <option value="">No checklists assigned</option> : null}
                {routineLists.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block w-56">
              <span className={`text-sm font-bold ${NAVY}`}>Department / Role</span>
              <select
                value={mode === "staff" ? role : session?.user?.role || ""}
                onChange={(e) => setRole(e.target.value)}
                disabled={mode !== "staff" || staffRoles.length < 2}
                className={selectClass}
                aria-label="Department / Role"
              >
                {(mode === "staff" ? staffRoles : [session?.user?.role || ""]).map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block w-44">
            <span className={`text-sm font-bold ${NAVY}`}>Date</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={selectClass} aria-label="Date" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <button type="button" onClick={() => setDate(shiftDayKey(date, -1))} className="px-3 py-2 text-gray-600 hover:text-gray-900" aria-label="Previous day">‹</button>
              <span className={`min-w-[150px] text-center text-sm font-bold ${NAVY}`}>{formatDayKey(date)}</span>
              <button type="button" onClick={() => setDate(shiftDayKey(date, 1))} className="px-3 py-2 text-gray-600 hover:text-gray-900" aria-label="Next day">›</button>
            </div>
            <button type="button" onClick={() => setDate(todayKey())} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:bg-gray-800">
              Today
            </button>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {!centerId ? (
          <div className={`${card} text-sm text-gray-500`}>Choose a center to see your checklist.</div>
        ) : (
          <div className={`flex flex-col gap-4 ${sidePanel ? "lg:flex-row lg:items-start" : ""}`}>
            <div className="min-w-0 flex-1 space-y-4">
              <div className={card}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${NAVY}`}>Day Progress</span>
                  <span className={`font-bold ${NAVY}`}>{progress.done}/{progress.total} ({progress.pct}%)</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress.pct}%` }} />
                </div>
              </div>

              <div className={card}>
                {loading && !checklists.length ? (
                  <Skeleton count={5} />
                ) : !shown.length ? (
                  <p className="text-sm text-gray-500">No checklist is assigned to you for this day.</p>
                ) : (
                  shown.map((checklist, index) => (
                    <div key={checklist.id} className={index ? "mt-5 border-t border-gray-100 pt-4 dark:border-gray-800" : ""}>
                      <h2 className={`mb-2 text-lg font-black ${NAVY}`}>
                        {mode === "teacher" || shown.length > 1 ? checklist.title : `${headingLabel} Daily Checklist`}
                      </h2>
                      <ChecklistItems
                        checklist={checklist}
                        isDone={isDone}
                        canComplete={canComplete}
                        busyItem={busyItem}
                        onToggle={toggle}
                        onDetails={(item) => setDetail({ checklist, item, completion: (item.completions || [])[0] || null })}
                      />
                    </div>
                  ))
                )}
              </div>

              {mode === "teacher" && scheduledLists.length ? (
                <div className={card}>
                  {scheduledLists.map((checklist) => (
                    <div key={checklist.id}>
                      <h2 className={`mb-2 text-lg font-black ${NAVY}`}>{checklist.title}</h2>
                      <ChecklistItems
                        checklist={checklist}
                        isDone={isDone}
                        canComplete={canComplete}
                        busyItem={busyItem}
                        onToggle={toggle}
                        onDetails={(item) => setDetail({ checklist, item, completion: (item.completions || [])[0] || null })}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {shown.length ? (
                <div className={card}>
                  <h2 className={`mb-2 text-lg font-black ${NAVY}`}>Checklist Notes</h2>
                  {shown.map((checklist) => (
                    <label key={checklist.id} className="mb-2 block">
                      {shown.length > 1 ? <span className="text-xs font-semibold text-gray-500">{checklist.title}</span> : null}
                      <textarea
                        rows={3}
                        value={noteDrafts[checklist.id] || ""}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [checklist.id]: e.target.value }))}
                        placeholder="Add any notes for today's checklist..."
                        aria-label={`Notes for ${checklist.title}`}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                    </label>
                  ))}
                  <div className="flex items-center justify-end gap-3">
                    {noteSaved ? <span className="text-sm font-semibold text-emerald-700">Saved</span> : null}
                    <button type="button" onClick={saveNotes} disabled={savingNote} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                      {savingNote ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {sidePanel ? (
              <div className="w-full space-y-3 lg:w-[380px] lg:shrink-0">
                {mode === "teacher" ? (
                  teacherClassId ? (
                    <>
                      <WeeklyLessonPlanner centerId={centerId} classId={teacherClassId} mode="teacher" singleDay />
                      <NextWeekSupplies centerId={centerId} classRoomId={teacherClassId} />
                    </>
                  ) : (
                    <div className={`${card} text-sm text-gray-500`}>The weekly lesson plan shows once you are assigned a classroom.</div>
                  )
                ) : null}
                {isKitchen ? <KitchenShoppingList centerId={centerId} /> : null}
                <AdditionalSupplyRequest centerId={centerId} classRoomId={teacherClassId || null} />
              </div>
            ) : null}
          </div>
        )}
      </div>
      <ChecklistItemDetailModal detail={detail} onClose={() => setDetail(null)} />
    </Layout>
  );
}

function ChecklistItems({ checklist, isDone, canComplete, busyItem, onToggle, onDetails }) {
  const [blockedId, setBlockedId] = useState("");
  const items = sortByTaskTime(checklist.items);
  if (!items.length) return <p className="text-sm text-gray-500">Nothing is due on this checklist today.</p>;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {items.map((item) => {
        const done = isDone(item);
        const needsVisit = !done && item.logActivityLink && !item.logActivityVisited;
        const href = checklistItemHref(item);
        return (
          <li key={item.id} className="flex items-start gap-3 py-2">
            <input
              type="checkbox"
              checked={done}
              disabled={!canComplete || busyItem === item.id}
              onChange={() => {
                // Log Activity items can't be ticked until the link was opened (client 2026-10-23).
                if (needsVisit) return setBlockedId(item.id);
                setBlockedId("");
                onToggle(item);
              }}
              aria-label={item.title}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
              {item.taskTime ? <div className="text-[11px] font-semibold uppercase text-blue-700 dark:text-blue-300">{formatTaskTime(item.taskTime)}</div> : null}
              <div className={`text-sm ${done ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{item.title}</div>
              {item.description ? <div className="text-xs text-gray-500">{item.description}</div> : null}
              {hasLinkedDetails(item) || href ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {hasLinkedDetails(item) ? (
                    <button type="button" onClick={() => onDetails(item)} className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800">
                      View linked details
                    </button>
                  ) : null}
                  {href ? (
                    <Link href={href} className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800">
                      {item.directLinkLabel || "Link"}
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {needsVisit && blockedId === item.id ? (
                <div role="alert" className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{LOG_FIRST_MESSAGE}</div>
              ) : needsVisit ? (
                <div className="mt-1 text-[11px] font-semibold text-amber-700">Click the Log Activity link to log this activity before checking it off.</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
