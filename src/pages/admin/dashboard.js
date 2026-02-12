import AdminLayout from "@/components/admin/AdminLayout";
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
          apiJson(`/api/v1/compliance/summary?centerId=${encodeURIComponent(centerId)}`),
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
                Attendance, red flags, alerts, and quick links.
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
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : !centerId ? (
            <div className="mt-4 text-sm text-gray-600">
              Choose a center to view the admin dashboard.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Tile
                title="All children clocked in"
                value={
                  attendanceSummary
                    ? `${attendanceSummary.checkedIn} / ${attendanceSummary.total}`
                    : "Not available"
                }
                subtitle="Checked in today"
                href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
              />
              <Tile
                title="Red flags"
                value={String(redFlags.length)}
                subtitle="Missing DOB/classroom"
                href={`/admin/children?centerId=${encodeURIComponent(centerId)}`}
              />
              <Tile
                title="Missed compliance items"
                value={String(missedTeacherLogs.length)}
                subtitle="Teachers with no logs in last 24h"
                href={`/admin/teacher-logging-alerts?centerId=${encodeURIComponent(centerId)}`}
              />
              <Tile
                title="Alerts / messages"
                value="View"
                subtitle="Messages from teachers/parents"
                href={`/admin/messages?centerId=${encodeURIComponent(centerId)}`}
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
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  No missing teacher logs detected.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function Tile({ title, value, subtitle, href }) {
  return (
    <Link href={href} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
    </Link>
  );
}

function QuickLink({ href, label }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}
