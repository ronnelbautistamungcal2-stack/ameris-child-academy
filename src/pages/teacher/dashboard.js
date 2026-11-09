import { CenterSelect, DashboardWelcome, PanelHeading, StatBubble, ViewAll, panel } from "@/components/dashboard/RoleDashboard";
import TeacherCalendarPanel from "@/components/teacher/TeacherCalendarPanel";
import TeacherLayout from "@/components/teacher/TeacherLayout";
import { WorkspaceState } from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
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

  // Client request: red flags and children present open the classroom list.
  const redFlagChildrenHref = "/teacher/classroom";
  const messagesHref = useMemo(() => {
    if (!centerId) return "/teacher/messages";
    return `/teacher/messages?centerId=${encodeURIComponent(centerId)}`;
  }, [centerId]);

  // Layout (client sheet 2026-11-07): the welcome line and clock, three
  // bubbles, a smaller calendar with My Classroom on the right and the
  // supplies needed this week under it; no quick links.
  return (
    <TeacherLayout
      title="Dashboard"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
    >
      <div className="space-y-5">
        <DashboardWelcome controls={centers.length > 1 ? <CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} /> : null} />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!centerId && !loading ? (
          <WorkspaceState title="Select a center to load your classroom." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatBubble kind="studentsPresent" icon={"\u{1F465}"} value={attendanceSummary ? attendanceSummary.checkedIn : "…"} label="Children Present" href={redFlagChildrenHref} />
            <StatBubble kind="redFlags" icon={"\u{1F6A9}"} value={flags.summary.openCount} label="Child Flags" href={redFlagChildrenHref} />
            <StatBubble kind="messages" icon={"✉️"} value={unreadMessages} label="New Messages" href={messagesHref} />
          </div>
        )}

        {centerId ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <section className={panel}>
              <TeacherCalendarPanel centerId={centerId} title="Calendar" />
            </section>
            <div className="space-y-4">
              <section className={panel}>
                <PanelHeading icon={"\u{1F465}"} title="My Classroom" action={<ViewAll href="/teacher/classroom" />} />
                {classroomRoster.length ? (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-sky-50 text-left text-xs font-bold uppercase text-gray-600 dark:bg-sky-900/30 dark:text-gray-300">
                          <th className="px-3 py-2">Child Name</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {classroomRoster.map((row) => {
                          const time = row.status === "checked_out" ? row.checkedOutAt : row.checkedInAt;
                          return (
                            <tr key={row.child?.id}>
                              <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">{fullName(row.child) || row.child?.id}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                                    row.status === "checked_in"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : row.status === "checked_out"
                                        ? "bg-slate-100 text-slate-700"
                                        : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {row.status === "checked_in" ? "Clocked In" : row.status === "checked_out" ? "Clocked Out" : "Absent"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                {time ? new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No children are in your classroom yet.</p>
                )}
              </section>
              <section className={panel}>
                <PanelHeading icon={"\u{1F4CB}"} title="Supplies Needed This Week" subtitle={supplyWeekLabel} action={<ViewAll href="/teacher/checklists" />} />
                {supplyList.length ? (
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {supplyList.map((s) => (
                      <li key={`${s.name}|${s.unit || ""}`} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded border border-blue-400" />
                        <span className="min-w-0 break-words">
                          {s.name}
                          {s.unit ? ` (${s.unit})` : ""}
                          {s.totalQuantity > 1 ? ` ×${s.totalQuantity}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No supplies are needed for the planned lessons.</p>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </TeacherLayout>
  );
}
