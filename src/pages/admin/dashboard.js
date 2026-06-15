import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceSection,
  WorkspaceState,
  workspaceInputClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AdminDashboard() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [childFlagsSummary, setChildFlagsSummary] = useState({
    openCount: 0,
    closedCount: 0,
  });
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
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
      setClasses([]);
      setAttendance(null);
      setChildFlagsSummary({ openCount: 0, closedCount: 0 });
      setSelectedRoomId("");
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [kids, roomRows, att, childFlags] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
          apiJson(
            `/api/v1/child-flags?centerId=${encodeURIComponent(centerId)}&summaryOnly=1`,
          ).catch(() => null),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setClasses(Array.isArray(roomRows) ? roomRows : []);
        setAttendance(att);
        setChildFlagsSummary({
          openCount: Number(childFlags?.summary?.openCount || 0),
          closedCount: Number(childFlags?.summary?.closedCount || 0),
        });
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
    const checkedOut = Math.max(total - checkedIn, 0);
    return { total, checkedIn, checkedOut };
  }, [attendance]);

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";
  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);

  const childFlagsHref = useMemo(() => {
    if (!centerId) return "/admin/children";
    const params = new URLSearchParams({
      centerId,
      view: "flags",
    });
    return `/admin/children?${params.toString()}`;
  }, [centerId]);

  const roomSummaries = useMemo(() => {
    const map = new Map();

    for (const room of classes) {
      const staffMembers = (room.teachers || [])
        .map((entry) => entry?.teacher)
        .filter(Boolean)
        .map((teacher) => ({
          id: teacher.id,
          name: teacher.name || teacher.email || "Teacher",
          email: teacher.email || "",
        }));

      map.set(room.id, {
        id: room.id,
        name: room.name || "Unnamed classroom",
        ageRange: room.ageRange || "",
        capacity: room.capacity,
        staffMembers,
        checkedInChildren: [],
        checkedOutChildren: [],
      });
    }

    for (const child of children) {
      const effectiveClassRoomId =
        child?.effectiveClassRoomId || child?.classRoomId || "unassigned";
      if (!map.has(effectiveClassRoomId)) {
        map.set(effectiveClassRoomId, {
          id: effectiveClassRoomId,
          name: effectiveClassRoomId === "unassigned" ? "Unassigned" : effectiveClassRoomId,
          ageRange: "",
          capacity: null,
          staffMembers: [],
          checkedInChildren: [],
          checkedOutChildren: [],
        });
      }

      const room = map.get(effectiveClassRoomId);
      if (isChildCheckedInToday(child)) room.checkedInChildren.push(child);
      else room.checkedOutChildren.push(child);
    }

    return [...map.values()]
      .map((room) => {
        const studentsIn = room.checkedInChildren.length;
        const studentsOut = room.checkedOutChildren.length;
        const staffCount = room.staffMembers.length;
        return {
          ...room,
          staffCount,
          studentsIn,
          studentsOut,
          totalStudents: studentsIn + studentsOut,
          ratio:
            staffCount > 0 ? (studentsIn / staffCount).toFixed(1) : "—",
        };
      })
      .sort((left, right) => {
        if (right.studentsIn !== left.studentsIn) {
          return right.studentsIn - left.studentsIn;
        }
        return left.name.localeCompare(right.name);
      });
  }, [children, classes]);

  useEffect(() => {
    if (!roomSummaries.length) {
      setSelectedRoomId("");
      return;
    }
    if (roomSummaries.some((room) => room.id === selectedRoomId)) return;
    setSelectedRoomId(roomSummaries[0].id);
  }, [roomSummaries, selectedRoomId]);

  const selectedRoom = useMemo(
    () => roomSummaries.find((room) => room.id === selectedRoomId) || null,
    [roomSummaries, selectedRoomId],
  );

  return (
    <AdminLayout
      title="Dashboard"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1440px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Admin Dashboard"
          title={
            selectedCenterName
              ? `${selectedCenterName} live operations`
              : "Center live operations"
          }
          description="Monitor child flags, jump into daily admin tools, and review live room status with clear in-and-out visibility."
          meta={
            <>
              <WorkspacePill tone="amber">{headerDate}</WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : (
                <WorkspacePill tone="slate">
                  Select a center to load live data
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
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to load today's admin snapshot."
            description="Center scope carries in the URL so attendance, child records, and classroom workflows stay aligned."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Tile
                title="Attendance"
                value={
                  attendanceSummary
                    ? `${attendanceSummary.checkedIn} in / ${attendanceSummary.checkedOut} out`
                    : "Unavailable"
                }
                subtitle={
                  attendanceSummary
                    ? `Live room status across ${roomSummaries.length} room${roomSummaries.length === 1 ? "" : "s"}`
                    : "Attendance data is not available right now"
                }
                href="#live-room-status"
                color="sky"
                icon={<IconUsers className="h-6 w-6" />}
              />
              <Tile
                title="Child Flags"
                value={String(childFlagsSummary.openCount)}
                subtitle="Open flags requiring review"
                href={childFlagsHref}
                color={childFlagsSummary.openCount > 0 ? "amber" : "emerald"}
                icon={<IconFlag className="h-6 w-6" />}
              />
              <Tile
                title="Messages"
                value="Open"
                subtitle="Teacher and parent conversations"
                href={`/admin/messages?centerId=${encodeURIComponent(centerId)}`}
                color="violet"
                icon={<IconMessage className="h-6 w-6" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.35fr]">
              <WorkspaceSection
                title="Quick Links"
                description="Jump into the busiest admin workflows for this center."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <QuickLink href="/admin/users" label="Team Directory" />
                  <QuickLink href="/admin/time-off" label="Time Off" />
                  <QuickLink href="/admin/calendar" label="Calendar" />
                  <QuickLink
                    href={`/admin/classes?centerId=${encodeURIComponent(centerId)}`}
                    label="Classrooms"
                  />
                  <QuickLink
                    href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
                    label="Children"
                  />
                  <QuickLink href="/admin/lessons" label="Curriculum" />
                  <QuickLink
                    href={`/admin/reports?centerId=${encodeURIComponent(centerId)}`}
                    label="Reports"
                  />
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                title="Attendance Snapshot"
                description="See who is clocked in and who is out before opening the live room board."
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MiniStatCard
                    label="Clocked In"
                    value={attendanceSummary?.checkedIn ?? 0}
                    tone="emerald"
                  />
                  <MiniStatCard
                    label="Clocked Out"
                    value={attendanceSummary?.checkedOut ?? 0}
                    tone="rose"
                  />
                  <MiniStatCard
                    label="Rooms Active"
                    value={roomSummaries.filter((room) => room.studentsIn > 0).length}
                    tone="sky"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roomSummaries.slice(0, 6).map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        room.id === selectedRoomId
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:text-sky-700",
                      ].join(" ")}
                    >
                      {room.name}: {room.studentsIn} in / {room.studentsOut} out
                    </button>
                  ))}
                </div>
              </WorkspaceSection>
            </div>

            <div id="live-room-status">
              <WorkspaceSection
                title="Live Room Status"
                description="Click a classroom row to review the current roster, assigned teachers, and who is clocked in or out."
              >
                {roomSummaries.length ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
                            <th className="px-4 py-3">Room Name</th>
                            <th className="px-4 py-3">Capacity</th>
                            <th className="px-4 py-3">Clocked In</th>
                            <th className="px-4 py-3">Clocked Out</th>
                            <th className="px-4 py-3">Staff</th>
                            <th className="px-4 py-3">Current Ratio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {roomSummaries.map((room) => {
                            const selected = room.id === selectedRoomId;
                            return (
                              <tr
                                key={room.id}
                                className={selected ? "bg-sky-50/70" : "bg-white"}
                              >
                                <td className="px-4 py-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRoomId(room.id)}
                                    className="w-full text-left"
                                  >
                                    <div className="font-semibold text-gray-900">
                                      {room.name}
                                    </div>
                                    {room.ageRange ? (
                                      <div className="mt-0.5 text-xs text-gray-500">
                                        {room.ageRange}
                                      </div>
                                    ) : null}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 text-gray-700">
                                  {room.capacity ?? "—"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    {room.studentsIn}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                    {room.studentsOut}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-700">
                                  {room.staffCount}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="font-semibold text-sky-800">
                                    {room.ratio}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {selectedRoom ? (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/45 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                              Selected Classroom
                            </div>
                            <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                              {selectedRoom.name}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                              <InfoPill label={`${selectedRoom.studentsIn} in`} tone="emerald" />
                              <InfoPill label={`${selectedRoom.studentsOut} out`} tone="rose" />
                              <InfoPill
                                label={`${selectedRoom.staffCount} staff`}
                                tone="sky"
                              />
                              <InfoPill
                                label={`Ratio ${selectedRoom.ratio}`}
                                tone="slate"
                              />
                            </div>
                          </div>
                          <Link
                            href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
                            className="inline-flex shrink-0 items-center rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            Open children
                          </Link>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.85fr]">
                          <div className="rounded-2xl border border-white/80 bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">
                                  Students
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                  Live roster for the selected classroom.
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 space-y-4">
                              <RosterGroup
                                title={`Clocked In (${selectedRoom.checkedInChildren.length})`}
                                tone="emerald"
                                children={selectedRoom.checkedInChildren}
                                centerId={centerId}
                              />
                              <RosterGroup
                                title={`Clocked Out (${selectedRoom.checkedOutChildren.length})`}
                                tone="rose"
                                children={selectedRoom.checkedOutChildren}
                                centerId={centerId}
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/80 bg-white p-4">
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">
                              Assigned Staff
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Teachers currently assigned to this classroom.
                            </div>

                            {selectedRoom.staffMembers.length ? (
                              <div className="mt-4 space-y-2">
                                {selectedRoom.staffMembers.map((teacher) => (
                                  <div
                                    key={teacher.id}
                                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3"
                                  >
                                    <div className="font-semibold text-gray-900">
                                      {teacher.name}
                                    </div>
                                    {teacher.email ? (
                                      <div className="mt-1 text-xs text-gray-500">
                                        {teacher.email}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                                No teachers are assigned to this classroom yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    No classroom or attendance data is available for this center yet.
                  </div>
                )}
              </WorkspaceSection>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function formatHeaderDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function childFullName(child) {
  return `${child?.firstName || ""}${child?.lastName ? ` ${child.lastName}` : ""}`.trim() || "Unnamed child";
}

function childInitials(child) {
  const first = String(child?.firstName || "").trim().charAt(0).toUpperCase();
  const last = String(child?.lastName || "").trim().charAt(0).toUpperCase();
  return `${first}${last}` || "C";
}

function isChildCheckedInToday(child) {
  return !!child?.todayAttendance?.checkedInAt && !child?.todayAttendance?.checkedOutAt;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  violet: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    hover: "hover:bg-blue-100/70 hover:border-blue-300",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-900",
    arrow: "group-hover:text-blue-700",
  },
};

function Tile({ title, value, subtitle, href, color = "sky", icon }) {
  const palette = TILE_COLORS[color] || TILE_COLORS.sky;
  return (
    <Link
      href={href}
      className={[
        "group block rounded-2xl border p-4 transition-all duration-200 hover:shadow-md",
        palette.bg,
        palette.border,
        palette.hover,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </div>
        {icon ? (
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              palette.icon,
            ].join(" ")}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className={["mt-2 text-2xl font-extrabold", palette.value].join(" ")}>
        {value}
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-gray-600">
        <span className="min-w-0 break-words">{subtitle}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            "h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5",
            palette.arrow,
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

function QuickLink({ href, label }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-all duration-200 hover:border-sky-200 hover:bg-sky-50/50 hover:text-sky-700"
    >
      <span className="min-w-0 break-words">{label}</span>
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

function MiniStatCard({ label, value, tone }) {
  const styles = {
    sky: "border-sky-100 bg-sky-50 text-sky-900",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-900",
    rose: "border-rose-100 bg-rose-50 text-rose-900",
  };

  return (
    <div className={["rounded-2xl border px-4 py-3", styles[tone] || styles.sky].join(" ")}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function InfoPill({ label, tone = "slate" }) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <span
      className={[
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles[tone] || styles.slate,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function RosterGroup({ title, tone, children, centerId }) {
  const toneStyles = {
    emerald: {
      badge: "bg-emerald-50 text-emerald-700",
      avatar: "bg-emerald-100 text-emerald-700",
      time: "text-emerald-700",
    },
    rose: {
      badge: "bg-rose-50 text-rose-700",
      avatar: "bg-rose-100 text-rose-700",
      time: "text-rose-700",
    },
  };
  const styles = toneStyles[tone] || toneStyles.emerald;

  return (
    <div>
      <div className={["inline-flex rounded-full px-2.5 py-1 text-xs font-bold", styles.badge].join(" ")}>
        {title}
      </div>
      {children.length ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {children
            .slice()
            .sort((left, right) => childFullName(left).localeCompare(childFullName(right)))
            .map((child) => {
              const timeValue =
                tone === "emerald"
                  ? child?.todayAttendance?.checkedInAt
                  : child?.todayAttendance?.checkedOutAt;
              return (
                <Link
                  key={child.id}
                  href={`/admin/children?centerId=${encodeURIComponent(centerId)}&childId=${encodeURIComponent(child.id)}`}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 transition hover:border-sky-200 hover:bg-sky-50/60"
                >
                  <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black", styles.avatar].join(" ")}>
                    {childInitials(child)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900">
                      {childFullName(child)}
                    </div>
                    <div className={["mt-1 text-xs font-semibold", styles.time].join(" ")}>
                      {tone === "emerald" ? "In" : "Out"} {formatTime(timeValue) || "today"}
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
          No children in this group right now.
        </div>
      )}
    </div>
  );
}

function IconUsers({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconFlag({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 3v18m0-13.5c2.75 0 4.25-1.5 7-1.5s4.25 1.5 7 1.5v8.25c-2.75 0-4.25-1.5-7-1.5s-4.25 1.5-7 1.5" />
    </svg>
  );
}

function IconMessage({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
