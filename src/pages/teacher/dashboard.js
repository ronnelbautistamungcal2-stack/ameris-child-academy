import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceState,
  workspaceInputClass,
  workspaceSecondaryButtonClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { getFlagCategoryLabel } from "@/lib/childFlags";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

export default function TeacherDashboard() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [threads, setThreads] = useState([]);
  const [flags, setFlags] = useState({ items: [], summary: { openCount: 0, closedCount: 0 } });
  const [supplies, setSupplies] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, messageThreads] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/messages/threads").catch(() => []),
        ]);
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        setThreads(Array.isArray(messageThreads) ? messageThreads : []);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setChildren([]);
      setAttendance(null);
      setFlags({ items: [], summary: { openCount: 0, closedCount: 0 } });
      setSupplies(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [kids, att, flagData, supplyData] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
          apiJson(`/api/v1/child-flags?centerId=${encodeURIComponent(centerId)}&status=open`).catch(
            () => null,
          ),
          apiJson(`/api/v1/lessons/next-week-supplies?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setAttendance(att);
        setFlags(
          flagData && typeof flagData === "object"
            ? flagData
            : { items: [], summary: { openCount: 0, closedCount: 0 } },
        );
        setSupplies(supplyData);
      } catch (e) {
        setError(e.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const attendanceSummary = useMemo(() => {
    if (!attendance) return null;
    const total = Number(attendance.totalChildren || 0);
    const checkedIn = Number(attendance.checkedInCount || 0);
    return { total, checkedIn };
  }, [attendance]);

  const classroomRoster = useMemo(() => {
    if (!attendance) return [];
    const rows = [
      ...(attendance.checkedInChildren || []),
      ...(attendance.missingChildren || []),
    ];
    return rows
      .map((row) => {
        const child = row.child;
        const today = child?.todayAttendance;
        const checkedInAt = today?.checkedInAt || row.checkedInAt || null;
        const checkedOutAt = today?.checkedOutAt || null;
        const status = checkedOutAt
          ? "checked_out"
          : checkedInAt
            ? "checked_in"
            : "not_checked_in";
        return { child, checkedInAt, checkedOutAt, status };
      })
      .sort((a, b) => fullName(a.child).localeCompare(fullName(b.child)));
  }, [attendance]);

  const visibleThreads = useMemo(() => {
    if (!centerId) return [];
    return (threads || [])
      .filter(
        (thread) =>
          !thread?.centerId ||
          thread.centerId === centerId ||
          thread.center?.id === centerId,
      )
      .sort((left, right) => {
        const leftTime = left?.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right?.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [centerId, threads]);

  const unreadMessages = useMemo(
    () => visibleThreads.reduce((sum, thread) => sum + Number(thread?.unreadCount || 0), 0),
    [visibleThreads],
  );

  const supplyList = supplies?.supplies || [];
  const supplyWeekLabel = useMemo(() => {
    if (!supplies?.weekStart || !supplies?.weekEnd) return "Next Week";
    const start = new Date(`${supplies.weekStart}T00:00:00`);
    const end = new Date(`${supplies.weekEnd}T00:00:00`);
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [supplies]);

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";
  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);
  const redFlagChildrenHref = useMemo(() => {
    if (!centerId) return "/teacher/children";
    const params = new URLSearchParams({
      centerId,
      flagged: "1",
    });
    return `/teacher/children?${params.toString()}`;
  }, [centerId]);
  const messagesHref = useMemo(() => {
    if (!centerId) return "/teacher/messages";
    return `/teacher/messages?centerId=${encodeURIComponent(centerId)}`;
  }, [centerId]);

  return (
    <TeacherLayout
      title="Dashboard"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Teacher Dashboard"
          title={
            selectedCenterName
              ? `${selectedCenterName} classroom snapshot`
              : "Daily classroom snapshot"
          }
          description="Keep attendance, messages, and child profile gaps visible in one center-aware teacher workspace."
          meta={
            <>
              <WorkspacePill tone="amber">{headerDate}</WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : (
                <WorkspacePill tone="slate">
                  Select a center to load live classroom data
                </WorkspacePill>
              )}
            </>
          }
          controls={
            <label className="block">
              <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Center View
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className={workspaceInputClass}
              >
                <option value="">Select a center to load data...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          }
        />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to load your classroom snapshot."
            description="The selected center stays in the URL so checklists, messages, and classroom tools keep the same context when you move between pages."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Tile
              title="Attendance"
              value={
                attendanceSummary
                  ? formatCountSummary(
                      attendanceSummary.checkedIn,
                      attendanceSummary.total,
                    )
                  : "Unavailable"
              }
              subtitle={
                attendanceSummary
                  ? "Children checked in today"
                  : "Attendance data is not available right now"
              }
              href="/teacher/classroom"
              color="sky"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
            <Tile
              title="Child Flags"
              value={String(flags.summary.openCount)}
              subtitle={flags.summary.openCount ? "Open flags requiring review" : "All clear"}
              href={redFlagChildrenHref}
              color={flags.summary.openCount ? "amber" : "emerald"}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
            />
            <Tile
              title="Messages"
              value={String(unreadMessages)}
              subtitle={unreadMessages ? "Unread replies in this center" : "You are caught up"}
              href={messagesHref}
              color="violet"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              }
            />
          </div>
        )}

        {centerId ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className="lg:col-span-2 xl:col-span-2">
              <Card
                title="Classroom"
                subtitle={
                  attendanceSummary
                    ? `${formatCountSummary(attendanceSummary.checkedIn, attendanceSummary.total)} checked in`
                    : "Attendance data not available"
                }
                href="/teacher/classroom"
                hrefLabel="Open My Classroom"
                accent="sky"
                className="h-full"
              >
                {classroomRoster.length ? (
                  <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1 text-sm text-gray-700">
                    {classroomRoster.map((row) => (
                      <li
                        key={row.child?.id}
                        className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 last:border-b-0"
                      >
                        <span className="min-w-0 break-words font-semibold text-gray-900">
                          {fullName(row.child) || row.child?.id}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {row.status === "checked_in" ? (
                            <span className="text-xs text-gray-500">
                              {row.checkedInAt ? new Date(row.checkedInAt).toLocaleTimeString() : ""}
                            </span>
                          ) : row.status === "checked_out" ? (
                            <span className="text-xs text-gray-500">
                              {row.checkedOutAt ? new Date(row.checkedOutAt).toLocaleTimeString() : ""}
                            </span>
                          ) : null}
                          <StatusBadge
                            status={row.status === "not_checked_in" ? "pending" : row.status === "checked_in" ? "active" : "completed"}
                            label={
                              row.status === "checked_in"
                                ? "Clocked In"
                                : row.status === "checked_out"
                                  ? "Clocked Out"
                                  : "Not Checked In"
                            }
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No children are enrolled in this center yet.
                  </div>
                )}
              </Card>
            </div>

            <Card title="Quick links" subtitle="Jump to classroom tools" className="h-full">
              <div className="mt-3 grid grid-cols-1 gap-2">
                <QuickLink
                  href="/teacher/classroom"
                  label="My Classroom"
                  icon={
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h10.5a.75.75 0 010 1.5H12v13.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5H2V3.5h-.25A.75.75 0 011 2.75zM4 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM4.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM8 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM8.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/teacher/logs"
                  label="Log Activity"
                  icon={
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/teacher/messages"
                  label="Messages"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/teacher/checklists"
                  label="Checklists"
                  icon={
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V1.75A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 8zm11 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0114 8zm-6.828 2.172a.75.75 0 010 1.06l-1.061 1.062a.75.75 0 01-1.06-1.061l1.06-1.062a.75.75 0 011.061 0zm4.596 0a.75.75 0 011.06 0l1.062 1.06a.75.75 0 01-1.061 1.062l-1.06-1.061a.75.75 0 010-1.061zM10 14a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/teacher/calendar"
                  label="Calendar"
                  icon={
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/teacher/reports"
                  label="Reports"
                  icon={
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
                    </svg>
                  }
                />
              </div>
            </Card>

            <Card
              title="Supplies"
              subtitle={`Needed for ${supplyWeekLabel}`}
              href="/teacher/checklists"
              hrefLabel="Open Checklists"
              accent="sky"
              className="h-full"
            >
              {supplyList.length ? (
                <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {supplyList.map((s) => (
                    <li
                      key={`${s.name}|${s.unit || ""}`}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2"
                    >
                      <div className="break-words text-sm font-semibold text-sky-900">
                        {s.name}
                        {s.unit ? ` (${s.unit})` : ""}
                        {s.totalQuantity > 1 ? ` ×${s.totalQuantity}` : ""}
                      </div>
                      {s.lessons?.length ? (
                        <div className="mt-1 line-clamp-1 text-xs text-sky-700">
                          Needed for{" "}
                          {s.lessons.map((l) => l.title).join(", ")}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  No supplies are needed for lessons planned next week.
                </div>
              )}
            </Card>

            <Card
              title="Child flags"
              subtitle={flags.summary.openCount ? `${flags.summary.openCount} open flag${flags.summary.openCount === 1 ? "" : "s"} need attention` : "All clear"}
              href={redFlagChildrenHref}
              hrefLabel="Review Child Flags"
              accent={flags.summary.openCount > 0 ? "amber" : "emerald"}
              className="h-full"
            >
              {flags.items.length ? (
                <ul className="mt-3 space-y-2">
                  {flags.items.slice(0, 6).map((item) => (
                    <li
                      key={item.flagKey}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <div className="break-words text-sm font-semibold text-amber-900">
                        {item.child?.name || "Unknown"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <StatusBadge status="high" label={item.title} />
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-white px-2 py-0.5 font-semibold text-amber-700">
                          {getFlagCategoryLabel(item.category)}
                        </span>
                      </div>
                      {item.summary ? (
                        <div className="mt-1 line-clamp-1 text-xs text-amber-700">{item.summary}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  No open flags for children in your classroom(s).
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </TeacherLayout>
  );
}

function formatHeaderDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatCountSummary(value, total) {
  return `${value} of ${total}`;
}

const TILE_COLORS = {
  sky: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    hover: "hover:bg-sky-100/70 hover:border-sky-300",
    icon: "bg-sky-100 text-sky-600",
    value: "text-sky-900",
    arrow: "group-hover:text-sky-600",
  },
  pink: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    hover: "hover:bg-pink-100/70 hover:border-pink-300",
    icon: "bg-pink-100 text-pink-600",
    value: "text-pink-900",
    arrow: "group-hover:text-pink-600",
  },
  violet: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    hover: "hover:bg-blue-100/70 hover:border-blue-300",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-900",
    arrow: "group-hover:text-blue-700",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    hover: "hover:bg-amber-100/70 hover:border-amber-300",
    icon: "bg-amber-100 text-amber-600",
    value: "text-amber-900",
    arrow: "group-hover:text-amber-600",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    hover: "hover:bg-emerald-100/70 hover:border-emerald-300",
    icon: "bg-emerald-100 text-emerald-600",
    value: "text-emerald-900",
    arrow: "group-hover:text-emerald-600",
  },
};

function Tile({ title, value, subtitle, href, color = "sky", icon }) {
  const c = TILE_COLORS[color] || TILE_COLORS.sky;
  return (
    <Link
      href={href}
      className={[
        "group block rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        c.bg,
        c.border,
        c.hover,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
        {icon ? (
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              c.icon,
            ].join(" ")}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className={["mt-2 text-2xl font-extrabold", c.value].join(" ")}>{value}</div>
      <div className="mt-1 flex items-center justify-between text-sm text-gray-600">
        <span className="min-w-0 break-words">{subtitle}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            "h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5",
            c.arrow,
          ].join(" ")}
        >
          <path
            fillRule="evenodd"
            d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </Link>
  );
}

function Card({ title, subtitle, href, hrefLabel, children, accent, className = "" }) {
  const accentClass = accent ? CARD_ACCENTS[accent] : "";
  return (
    <div
      className={[
        "group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accentClass ? `border-l-4 ${accentClass}` : "",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </div>
          <div className="mt-1.5 break-words text-base font-extrabold text-gray-900">{subtitle}</div>
        </div>
        {href ? (
          <Link
            href={href}
            className={[workspaceSecondaryButtonClass, "shrink-0 text-xs font-extrabold"].join(" ")}
          >
            {hrefLabel || "Open"}
          </Link>
        ) : null}
      </div>
      <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      {children}
    </div>
  );
}

function QuickLink({ href, label, icon }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-all duration-200 hover:border-sky-200 hover:bg-sky-50/50 hover:text-sky-700"
    >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition group-hover:bg-sky-100">
            {icon}
          </span>
          <span className="min-w-0 break-words">{label}</span>
        </span>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sky-500"
      >
        <path
          fillRule="evenodd"
          d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  );
}

const CARD_ACCENTS = {
  sky: "border-l-sky-400",
  pink: "border-l-pink-400",
  violet: "border-l-violet-400",
  amber: "border-l-amber-400",
  emerald: "border-l-emerald-400",
};
