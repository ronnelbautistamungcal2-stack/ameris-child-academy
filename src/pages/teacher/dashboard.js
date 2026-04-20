import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceState,
  workspaceInputClass,
  workspacePrimaryButtonClass,
  workspaceSecondaryButtonClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function toDateKey(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function nextBirthdayDate(birthDate, now = new Date()) {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const out = new Date(now);
  out.setHours(0, 0, 0, 0);
  out.setMonth(d.getMonth(), d.getDate());
  if (out < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    out.setFullYear(out.getFullYear() + 1);
  }
  return out;
}

export default function TeacherDashboard() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const [scheduleDraft, setScheduleDraft] = useState("");
  const [scheduleItems, setScheduleItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  const dayKey = useMemo(() => toDateKey(new Date()), []);
  const scheduleStorageKey = useMemo(() => {
    if (!centerId) return "";
    return `aca:teacherSchedule:${centerId}:${dayKey}`;
  }, [centerId, dayKey]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
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
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [kids, att] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setAttendance(att);
      } catch (e) {
        setError(e.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    if (!scheduleStorageKey) {
      setScheduleItems([]);
      return;
    }

    try {
      const raw = localStorage.getItem(scheduleStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setScheduleItems(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
      setScheduleItems([]);
    }
  }, [scheduleStorageKey]);

  function persistSchedule(next) {
    setScheduleItems(next);
    if (!scheduleStorageKey) return;
    try {
      localStorage.setItem(scheduleStorageKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function addScheduleItem() {
    const text = String(scheduleDraft || "").trim();
    if (!text) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());
    persistSchedule([...scheduleItems, { id, text }]);
    setScheduleDraft("");
  }

  function removeScheduleItem(id) {
    persistSchedule(scheduleItems.filter((i) => i?.id !== id));
  }

  const attendanceSummary = useMemo(() => {
    if (!attendance) return null;
    const total = Number(attendance.totalChildren || 0);
    const checkedIn = Number(attendance.checkedInCount || 0);
    return { total, checkedIn };
  }, [attendance]);

  const upcomingBirthdays = useMemo(() => {
    const now = new Date();
    return (children || [])
      .filter((c) => c?.birthDate)
      .map((c) => ({
        child: c,
        next: nextBirthdayDate(c.birthDate, now),
      }))
      .filter((row) => row.next)
      .sort((a, b) => a.next - b.next)
      .slice(0, 6);
  }, [children]);

  const redFlagChildren = useMemo(() => {
    const flags = [];
    for (const child of children || []) {
      const list = [];
      if (child?.allergies) list.push("Allergies");
      if (!child?.birthDate) list.push("Missing DOB");
      if (!child?.classRoomId) list.push("Missing classroom");
      if (!child?.emergencyContact) list.push("Missing emergency contact");
      if (list.length) flags.push({ child, tags: list });
    }
    return flags.sort((a, b) => byString(fullName(a.child), fullName(b.child)));
  }, [children]);

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";
  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);

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
          description="Keep attendance, birthdays, saved schedule items, and child profile gaps visible in one center-aware teacher workspace."
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to load your classroom snapshot."
            description="The selected center stays in the URL so checklists, messages, and classroom tools keep the same context when you move between pages."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              title="Birthdays"
              value={String(upcomingBirthdays.length)}
              subtitle="Next 6 on file"
              href="/teacher/classroom"
              color="pink"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v10.5m6.364-8.114a9 9 0 11-12.728 0m12.728 0A9.002 9.002 0 1012 3a9.002 9.002 0 016.364 3.636z" />
                </svg>
              }
            />
            <Tile
              title="Schedule"
              value={String(scheduleItems.length)}
              subtitle="Items saved on this device today"
              href="/teacher/checklists"
              color="violet"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <Tile
              title="Profile Flags"
              value={String(redFlagChildren.length)}
              subtitle={redFlagChildren.length ? "Needs attention" : "All clear"}
              href="/teacher/classroom"
              color={redFlagChildren.length ? "amber" : "emerald"}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
            />
          </div>
        )}

        {centerId ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className="lg:col-span-2 xl:col-span-2">
              <Card
                title="Today's schedule"
                subtitle={`${dayKey} - saved on this device`}
                href="/teacher/checklists"
                hrefLabel="Open Checklists"
                accent="violet"
                className="h-full"
              >
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={scheduleDraft}
                      onChange={(e) => setScheduleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addScheduleItem();
                        }
                      }}
                      className={workspaceInputClass}
                      placeholder="Add item and press Enter (e.g., Circle time 9:30)"
                    />
                    <button
                      type="button"
                      onClick={addScheduleItem}
                      disabled={!String(scheduleDraft || "").trim()}
                      className={[workspacePrimaryButtonClass, "shrink-0"].join(" ")}
                    >
                      Add item
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Tip: add time first for clarity, like "9:30 Circle time".
                  </div>
                </div>
                {scheduleItems.length ? (
                  <ul className="mt-3 space-y-2">
                    {scheduleItems.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <span className="min-w-0 break-words font-semibold text-gray-900">
                          {it.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeScheduleItem(it.id)}
                          className={[workspaceSecondaryButtonClass, "shrink-0 px-3 py-1.5 text-xs"].join(" ")}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 text-sm text-gray-600">
                    Add a few anchor points for today's classroom flow.
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
              title="Children clocked in"
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
              {attendance?.checkedInChildren?.length ? (
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {attendance.checkedInChildren.slice(0, 6).map((row) => (
                    <li key={row.child?.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words font-semibold text-gray-900">
                        {fullName(row.child) || row.child?.id}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {row.checkedInAt ? new Date(row.checkedInAt).toLocaleTimeString() : "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  No check-ins have been recorded for this center yet today.
                </div>
              )}
            </Card>

            <Card
              title="Upcoming birthdays"
              subtitle={upcomingBirthdays.length ? "Next 6 birthdays" : "No birthdays on file"}
              href="/teacher/classroom"
              hrefLabel="View Roster"
              accent="pink"
              className="h-full"
            >
              {upcomingBirthdays.length ? (
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {upcomingBirthdays.map((row) => (
                    <li key={row.child?.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words font-semibold text-gray-900">
                        {fullName(row.child)}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {row.next.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  Add dates of birth on child profiles to surface birthdays here.
                </div>
              )}
            </Card>

            <Card
              title="Red flag children"
              subtitle={redFlagChildren.length ? `${redFlagChildren.length} need attention` : "All clear"}
              href="/teacher/classroom"
              hrefLabel="Review in Classroom"
              accent={redFlagChildren.length > 0 ? "amber" : "emerald"}
              className="h-full"
            >
              {redFlagChildren.length ? (
                <ul className="mt-3 space-y-2">
                  {redFlagChildren.slice(0, 6).map((row) => (
                    <li
                      key={row.child?.id}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <div className="break-words text-sm font-semibold text-amber-900">
                        {fullName(row.child)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {row.tags.map((t) => (
                          <StatusBadge key={t} status="high" label={t} />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  Flags appear when allergies or key child profile fields are
                  missing.
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
