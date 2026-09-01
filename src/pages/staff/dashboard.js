import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceSection,
  WorkspaceState,
  WorkspaceStat,
  workspaceInputClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { hasChecklistClassroomScope } from "@/lib/dailyChecklistClassrooms";
import { groupTimeOffRequests } from "@/lib/time-off";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function todayRange(daysAhead = 21) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildShiftStart(date, time) {
  const day = String(date || "").slice(0, 10);
  const clock = String(time || "00:00").padEnd(5, "0");
  const parsed = new Date(`${day}T${clock}`);
  return Number.isNaN(parsed.getTime()) ? new Date(date) : parsed;
}

function formatRoleDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareByUpdatedAt(left, right) {
  const leftTime = left?.updatedAt ? new Date(left.updatedAt).getTime() : 0;
  const rightTime = right?.updatedAt ? new Date(right.updatedAt).getTime() : 0;
  return rightTime - leftTime;
}

export default function StaffDashboardPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [threads, setThreads] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [calendarData, setCalendarData] = useState({ events: [], shifts: [], timeOff: [], birthdays: [] });
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [trainingSummary, setTrainingSummary] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoadingBase(true);
      setError("");
      try {
        const [centerRows, metricRows, messageThreads] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/metrics/me").catch(() => null),
          apiJson("/api/v1/messages/threads").catch(() => []),
        ]);
        setCenters(Array.isArray(centerRows) ? centerRows : []);
        setMetrics(metricRows);
        setThreads(Array.isArray(messageThreads) ? messageThreads : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load staff dashboard");
      } finally {
        setLoadingBase(false);
      }
    })();
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!centerId) {
      setChecklists([]);
      setCalendarData({ events: [], shifts: [], timeOff: [] });
      setTimeOffRequests([]);
      setTrainingSummary(null);
      setEvaluations([]);
      return;
    }

    setLoadingWorkspace(true);
    setError("");
    try {
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10);
      const range = todayRange();
      const [checklistRows, calendarRows, requestRows, trainingRows, evaluationRows] =
        await Promise.all([
          apiJson(
            `/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}&date=${encodeURIComponent(dateKey)}`,
          ).catch(() => []),
          apiJson(
            `/api/v1/calendar?centerId=${encodeURIComponent(centerId)}&from=${encodeURIComponent(range.start.toISOString())}&to=${encodeURIComponent(range.end.toISOString())}`,
          ).catch(() => ({ events: [], shifts: [], timeOff: [], birthdays: [] })),
          apiJson(`/api/v1/time-off?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
          apiJson(`/api/v1/training-logs/summary?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
          apiJson(`/api/v1/evaluations?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        ]);

      setChecklists(
        (Array.isArray(checklistRows) ? checklistRows : []).filter(
          (checklist) => !hasChecklistClassroomScope(checklist) && checklist?.category !== "CLASSROOM",
        ),
      );
      setCalendarData({
        events: Array.isArray(calendarRows?.events) ? calendarRows.events : [],
        shifts: Array.isArray(calendarRows?.shifts) ? calendarRows.shifts : [],
        timeOff: Array.isArray(calendarRows?.timeOff) ? calendarRows.timeOff : [],
        birthdays: Array.isArray(calendarRows?.birthdays) ? calendarRows.birthdays : [],
      });
      setTimeOffRequests(Array.isArray(requestRows) ? requestRows : []);
      setTrainingSummary(trainingRows);
      setEvaluations(Array.isArray(evaluationRows) ? evaluationRows : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load center workspace");
    } finally {
      setLoadingWorkspace(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";

  const visibleThreads = useMemo(() => {
    if (!centerId) return [];
    return (threads || [])
      .filter(
        (thread) =>
          !thread?.centerId ||
          thread.centerId === centerId ||
          thread.center?.id === centerId,
      )
      .slice()
      .sort(compareByUpdatedAt);
  }, [centerId, threads]);

  const unreadMessages = visibleThreads.reduce(
    (sum, thread) => sum + Number(thread.unreadCount || 0),
    0,
  );

  const checklistSummary = useMemo(() => {
    const totalItems = checklists.reduce(
      (sum, checklist) => sum + (checklist.items?.length || 0),
      0,
    );
    const completedItems = checklists.reduce(
      (sum, checklist) =>
        sum +
        (checklist.items || []).filter(
          (item) => Array.isArray(item.completions) && item.completions.length > 0,
        ).length,
      0,
    );
    const openItems = Math.max(totalItems - completedItems, 0);
    const percent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
    const nextOpenItems = checklists
      .flatMap((checklist) =>
        (checklist.items || [])
          .filter((item) => !Array.isArray(item.completions) || item.completions.length === 0)
          .map((item) => ({
            id: item.id,
            checklistTitle: checklist.title,
            title: item.title,
            taskTime: item.taskTime || "",
          })),
      )
      .sort((left, right) => String(left.taskTime || "99:99").localeCompare(String(right.taskTime || "99:99")))
      .slice(0, 5);

    return { totalItems, completedItems, openItems, percent, nextOpenItems };
  }, [checklists]);

  const upcomingCalendarItems = useMemo(() => {
    const today = new Date();
    return [
      ...(calendarData.events || []).map((event) => ({
        id: `event-${event.id}`,
        type: "Event",
        label: event.title,
        date: new Date(event.startDate),
        detail: event.description || "",
        tone: "sky",
      })),
      ...(calendarData.shifts || []).map((shift) => ({
        id: `shift-${shift.id}`,
        type: "Shift",
        label: `${shift.startTime}-${shift.endTime}${shift.position ? ` (${shift.position})` : ""}`,
        date: buildShiftStart(shift.date, shift.startTime),
        detail: shift.notes || "",
        tone: "amber",
      })),
      ...(calendarData.timeOff || []).map((request) => ({
        id: `timeoff-${request.id}`,
        type: "Time Off",
        label: `${request.type} (${request.status})`,
        date: new Date(request.startDate),
        detail: request.reason || "",
        tone: "emerald",
      })),
      ...(calendarData.birthdays || []).map((birthday) => ({
        id: `birthday-${birthday.id}`,
        type: "Birthday",
        label: `${birthday.user?.name || "—"}'s Birthday`,
        date: new Date(birthday.date),
        detail: Number.isFinite(birthday.age) ? `Turning ${birthday.age}` : "",
        tone: "rose",
      })),
    ]
      .filter((item) => !Number.isNaN(item.date.getTime()) && item.date >= today)
      .sort((left, right) => left.date - right.date)
      .slice(0, 6);
  }, [calendarData.events, calendarData.shifts, calendarData.timeOff, calendarData.birthdays]);

  const pendingTimeOff = useMemo(
    () => timeOffRequests.filter((request) => request.status === "PENDING"),
    [timeOffRequests],
  );

  const timeOffGroups = useMemo(() => groupTimeOffRequests(timeOffRequests), [timeOffRequests]);
  const pendingTimeOffGroups = useMemo(
    () => groupTimeOffRequests(pendingTimeOff),
    [pendingTimeOff],
  );

  const latestEvaluation = evaluations[0] || metrics?.evaluations?.latest || null;

  return (
    <StaffLayout
      title="Dashboard"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Other Staff Portal"
          title={
            selectedCenterName
              ? `${selectedCenterName} staff workspace`
              : "Staff workspace overview"
          }
          description="Messages, alerts, operations checklists, calendar items, training, time off, and shared resources are grouped here without classroom or child-management tools."
          meta={
            <>
              <WorkspacePill tone="amber">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : (
                <WorkspacePill tone="slate">Select a center to load center data</WorkspacePill>
              )}
            </>
          }
          controls={
            <label className="block">
              <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Center View
              </div>
              <select
                value={centerId}
                onChange={(event) => setCenterId(event.target.value)}
                className={workspaceInputClass}
                disabled={loadingBase}
              >
                <option value="">Select a center...</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          }
          stats={
            <>
              <WorkspaceStat
                label="Unread Messages"
                value={unreadMessages}
                description="Unread conversation items tied to this center view."
                href="/staff/messages"
                tone="sky"
              />
              <WorkspaceStat
                label="Open Checklist Items"
                value={checklistSummary.openItems}
                description="Operations tasks still waiting to be checked off today."
                href="/staff/checklists"
                tone="amber"
              />
              <WorkspaceStat
                label="Training Hours"
                value={trainingSummary?.totalHours ?? metrics?.training?.totalHours ?? 0}
                description="Logged training hours currently visible in your record."
                href="/staff/training"
                tone="emerald"
              />
              <WorkspaceStat
                label="Pending Time Off"
                value={pendingTimeOffGroups.length}
                description="Requests awaiting approval in the selected center."
                href="/staff/time-off"
                tone="slate"
              />
            </>
          }
        />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loadingBase ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to load your staff dashboard."
            description="Messages remain available, but the operations, time-off, calendar, and training summaries become center-aware once you choose a center."
          />
        ) : loadingWorkspace ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <Skeleton count={7} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <WorkspaceSection
                title="Quick Links"
                description="Jump directly into the non-classroom staff tools."
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <QuickLink href="/staff/messages" title="Messages" detail="Inbox and conversations" />
                  <QuickLink href="/staff/alerts" title="Alerts" detail="Unread activity and urgent updates" />
                  <QuickLink href="/staff/checklists" title="Checklists" detail="Daily operations and safety tasks" />
                  <QuickLink href="/staff/calendar" title="Calendar" detail="Events, shifts, and time off" />
                  <QuickLink href="/staff/training" title="Performance & Training" detail="Evaluations and training logs" />
                  <QuickLink href="/staff/time-off" title="Time Off" detail="Submit and track requests" />
                  <QuickLink href="/staff/resources" title="Resources" detail="Policies and reference documents" />
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Today's Operations"
                description="The next incomplete checklist items for this center."
                action={
                  <Link
                    href="/staff/checklists"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Open Checklists
                  </Link>
                }
              >
                {!checklistSummary.totalItems ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No center-wide checklist items are assigned for today.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-gray-700">
                          {checklistSummary.completedItems} of {checklistSummary.totalItems} tasks completed
                        </span>
                        <span className="text-lg font-black text-gray-900">
                          {checklistSummary.percent}%
                        </span>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            checklistSummary.percent === 100 ? "bg-emerald-500" : "bg-sky-500"
                          }`}
                          style={{ width: `${checklistSummary.percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {checklistSummary.nextOpenItems.length ? (
                        checklistSummary.nextOpenItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {item.checklistTitle}
                              {item.taskTime ? ` | ${item.taskTime}` : ""}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          All visible checklist items are complete for today.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </WorkspaceSection>

              <WorkspaceSection
                title="Upcoming Calendar"
                description="The next visible events, shifts, and approved time off."
                action={
                  <Link
                    href="/staff/calendar"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Open Calendar
                  </Link>
                }
              >
                {upcomingCalendarItems.length ? (
                  <div className="space-y-3">
                    {upcomingCalendarItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              item.tone === "sky"
                                ? "bg-sky-100 text-sky-700"
                                : item.tone === "amber"
                                  ? "bg-amber-100 text-amber-700"
                                  : item.tone === "rose"
                                    ? "bg-pink-100 text-pink-700"
                                    : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {item.type}
                          </span>
                          <div className="text-sm font-extrabold text-gray-900">{item.label}</div>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {item.date.toLocaleString()}
                        </div>
                        {item.detail ? (
                          <div className="mt-1 text-xs text-gray-500">{item.detail}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No upcoming items are scheduled inside the current date window.
                  </div>
                )}
              </WorkspaceSection>
            </div>

            <div className="space-y-4">
              <WorkspaceSection
                title="Alerts"
                description="Recent conversation activity and unread items."
                action={
                  <Link
                    href="/staff/alerts"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    View Alerts
                  </Link>
                }
              >
                {visibleThreads.length ? (
                  <div className="space-y-3">
                    {visibleThreads.slice(0, 5).map((thread) => {
                      const latestMessage = thread.messages?.[0] || null;
                      return (
                        <Link
                          key={thread.id}
                          href={`/staff/messages?threadId=${encodeURIComponent(thread.id)}`}
                          className="block rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-extrabold text-gray-900">
                              {thread.title || thread.center?.name || "Conversation"}
                            </div>
                            {(thread.unreadCount || 0) > 0 ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                {thread.unreadCount} unread
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {latestMessage?.body || "No messages yet"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {thread.updatedAt ? new Date(thread.updatedAt).toLocaleString() : ""}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No recent message activity is tied to this center yet.
                  </div>
                )}
              </WorkspaceSection>

              <WorkspaceSection
                title="Performance Snapshot"
                description="Training, evaluation, and attendance highlights from your profile."
                action={
                  <Link
                    href="/staff/training"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Open Performance
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <MiniMetric
                    label="Activities This Week"
                    value={metrics?.activities?.week ?? 0}
                  />
                  <MiniMetric
                    label="Training Entries"
                    value={trainingSummary?.totalEntries ?? metrics?.training?.entries ?? 0}
                  />
                  <MiniMetric
                    label="Late Minutes"
                    value={metrics?.attendance?.totalLateMinutes ?? 0}
                  />
                  <MiniMetric
                    label="Absences"
                    value={metrics?.attendance?.absent ?? 0}
                  />
                </div>
                {latestEvaluation ? (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                      Latest Evaluation
                    </div>
                    <div className="mt-2 text-base font-extrabold text-gray-900">
                      {latestEvaluation.period || "Evaluation"}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {formatStatus(latestEvaluation.status)}
                      {Number.isFinite(latestEvaluation.overallScore)
                        ? ` | ${latestEvaluation.overallScore}%`
                        : ""}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {formatRoleDate(latestEvaluation.createdAt)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No evaluations are available yet.
                  </div>
                )}
              </WorkspaceSection>

              <WorkspaceSection
                title="Time Off"
                description="Your latest request statuses for this center."
                action={
                  <Link
                    href="/staff/time-off"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Manage Time Off
                  </Link>
                }
              >
                {timeOffGroups.length ? (
                  <div className="space-y-3">
                    {timeOffGroups.slice(0, 4).map((group) => {
                      const request = group.items[0];
                      return (
                        <div
                          key={group.key}
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-extrabold text-gray-900">
                              {request.type || "Time Off"}
                            </div>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700">
                              {group.isGrouped
                                ? `${group.items.length}/${group.fullGroupSize} ${formatStatus(request.status)}`
                                : formatStatus(request.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {formatRoleDate(group.rangeStart)} to {formatRoleDate(group.rangeEnd)}
                          </div>
                          {request.reason ? (
                            <div className="mt-1 text-xs text-gray-500">{request.reason}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No time-off requests are on file for this center yet.
                  </div>
                )}
              </WorkspaceSection>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
}

function QuickLink({ href, title, detail }) {
  return (
    <Link
      href={href}
      className="rounded-[1.4rem] border border-gray-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-md"
    >
      <div className="text-sm font-extrabold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{detail}</div>
    </Link>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
    </div>
  );
}
