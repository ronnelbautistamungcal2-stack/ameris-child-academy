import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AdminDashboard() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);

  const [attendance, setAttendance] = useState(null);
  const [compliance, setCompliance] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const centersArr = Array.isArray(c) ? c : [];
        setCenters(centersArr);
        setCenterId(centersArr.length === 1 ? centersArr[0].id : "");
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
      setCompliance(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [kids, att, comp] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
          apiJson(`/api/v1/compliance/summary?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setAttendance(att);
        setCompliance(comp);
      } catch (e) {
        setError(e.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const redFlags = useMemo(() => {
    const flags = [];
    for (const child of children) {
      if (!child.birthDate) flags.push({ type: "Missing DOB", child });
      if (!child.classRoomId) flags.push({ type: "Missing classroom", child });
    }
    return flags;
  }, [children]);

  const missedTeacherLogs = useMemo(() => {
    const teachers = Array.isArray(compliance?.teachers) ? compliance.teachers : [];
    return teachers.filter((t) => (t?.logs?.last24Hours || 0) === 0);
  }, [compliance]);

  const attendanceSummary = useMemo(() => {
    if (!attendance) return null;
    const total = Number(attendance.totalChildren || 0);
    const checkedIn = Number(attendance.checkedInCount || 0);
    return { total, checkedIn };
  }, [attendance]);

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Dashboard</h2>
              <p className="mt-1 text-sm text-gray-600">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {" · "}Attendance, compliance & alerts
              </p>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : !centerId ? (
            <div className="mt-4 text-sm text-gray-600">
              Choose a center to view the admin dashboard.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Tile
                title="Attendance"
                value={
                  attendanceSummary
                    ? `${attendanceSummary.checkedIn} / ${attendanceSummary.total}`
                    : "—"
                }
                subtitle="Children checked in today"
                href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
                color="sky"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
              />
              <Tile
                title="Red flags"
                value={String(redFlags.length)}
                subtitle="Missing DOB or classroom"
                href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
                color={redFlags.length > 0 ? "amber" : "emerald"}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                }
              />
              <Tile
                title="Compliance"
                value={String(missedTeacherLogs.length)}
                subtitle="Teachers missing logs (24h)"
                href={`/admin/teacher-logging-alerts?centerId=${encodeURIComponent(centerId)}`}
                color={missedTeacherLogs.length > 0 ? "rose" : "emerald"}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <Tile
                title="Messages"
                value="Open"
                subtitle="Teacher & parent messages"
                href={`/admin/messages?centerId=${encodeURIComponent(centerId)}`}
                color="violet"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                }
              />
            </div>
          )}
        </div>

        {centerId ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-extrabold text-gray-900">Quick Links</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <QuickLink href="/admin/users" label="Employee List" />
                <QuickLink href="/admin/centers" label="Centers" />
                <QuickLink href={`/admin/classes?centerId=${encodeURIComponent(centerId)}`} label="Classrooms list" />
                <QuickLink href={`/admin/children?centerId=${encodeURIComponent(centerId)}`} label="Children list" />
                <QuickLink href="/admin/lessons" label="Curriculum list" />
                <QuickLink href={`/admin/reports?centerId=${encodeURIComponent(centerId)}`} label="Reports" />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-extrabold text-gray-900">
                Teacher logging alerts
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Teachers missing daily activity logs (last 24 hours).
              </p>
              {missedTeacherLogs.length ? (
                <div className="mt-3 space-y-2">
                  {missedTeacherLogs.slice(0, 6).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-amber-900">
                          {t.name || t.email}
                        </div>
                        <div className="truncate text-xs text-amber-800">
                          7 days: {t.logs?.last7Days || 0} • 24h:{" "}
                          {t.logs?.last24Hours || 0}
                        </div>
                      </div>
                      <Link
                        className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-700"
                        href={`/admin/teacher-logging-alerts?centerId=${encodeURIComponent(centerId)}`}
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-emerald-500">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  All teachers have submitted their daily logs. Great job!
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
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
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    hover: "hover:bg-rose-100/70 hover:border-rose-300",
    icon: "bg-rose-100 text-rose-600",
    value: "text-rose-900",
    arrow: "group-hover:text-rose-600",
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
  const c = TILE_COLORS[color] || TILE_COLORS.sky;
  return (
    <Link
      href={href}
      className={[
        "group block rounded-2xl border p-4 transition-all duration-200 hover:shadow-md",
        c.bg, c.border, c.hover,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
        {icon ? (
          <div className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", c.icon].join(" ")}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className={["mt-2 text-2xl font-extrabold", c.value].join(" ")}>{value}</div>
      <div className="mt-1 flex items-center justify-between text-sm text-gray-600">
        <span>{subtitle}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={["h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5", c.arrow].join(" ")}>
          <path fillRule="evenodd" d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z" clipRule="evenodd" />
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
      <span>{label}</span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sky-500">
        <path fillRule="evenodd" d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z" clipRule="evenodd" />
      </svg>
    </Link>
  );
}
