import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const TABS = [
  { key: "logging", label: "Missed Logging", icon: IconLogging, color: "amber" },
  { key: "attendance", label: "Missing Attendance", icon: IconAttendance, color: "red" },
  { key: "progress", label: "Overdue Progress", icon: IconProgress, color: "purple" },
];

export default function ComplianceAlerts() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [activeTab, setActiveTab] = useState("logging");

  const [summary, setSummary] = useState(null);
  const [compliance, setCompliance] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [alertResult, setAlertResult] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const centersArr = Array.isArray(c) ? c : [];
        setCenters(centersArr);
        const fromQuery =
          typeof router.query.centerId === "string" ? router.query.centerId : "";
        setCenterId(fromQuery || (centersArr.length === 1 ? centersArr[0].id : ""));
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, [router.query.centerId]);

  useEffect(() => {
    if (!centerId) {
      setSummary(null);
      setCompliance(null);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [s, c] = await Promise.all([
          apiJson(`/api/v1/compliance/summary?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/compliance/check?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setSummary(s);
        setCompliance(c);
      } catch (e) {
        setError(e.message || "Failed to load compliance data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const teachers = useMemo(() => {
    const arr = Array.isArray(summary?.teachers) ? summary.teachers : [];
    return [...arr].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [summary]);

  const flagged = useMemo(() => {
    return teachers.filter((t) => (t?.logs?.last24Hours || 0) === 0);
  }, [teachers]);

  async function sendAlerts() {
    setSendingAlerts(true);
    setAlertResult(null);
    try {
      const result = await apiJson("/api/v1/compliance/run-alerts", {
        method: "POST",
        body: JSON.stringify({ centerId: centerId || undefined }),
      });
      setAlertResult(result);
    } catch (e) {
      setError(e.message || "Failed to send alerts");
    } finally {
      setSendingAlerts(false);
    }
  }

  const missedCount = compliance?.missedLogging?.count ?? flagged.length;
  const attendanceCount = compliance?.missingAttendance?.count ?? 0;
  const overdueCount = compliance?.overdueProgress?.count ?? 0;
  const totalIssues = missedCount + attendanceCount + overdueCount;

  const tabCounts = {
    logging: missedCount,
    attendance: attendanceCount,
    progress: overdueCount,
  };

  return (
    <AdminLayout title="Compliance Alerts">
      <div className="space-y-5">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 via-white to-red-50 p-6">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-amber-100/40 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-red-100/30 blur-2xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-200">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">Compliance Alerts</h2>
                  <p className="text-sm text-gray-500">
                    Monitor missed logging, attendance gaps, and overdue progress updates
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Center</div>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <select
                      value={centerId}
                      onChange={(e) => setCenterId(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-gray-800 shadow-sm transition hover:border-amber-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 sm:w-64"
                    >
                      <option value="">Select a center...</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={sendAlerts}
                  disabled={sendingAlerts || !centerId}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingAlerts ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Send Alerts
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Alerts & messages */}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            )}

            {alertResult && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {alertResult.skipped
                  ? "Alerts already generated for today."
                  : alertResult.created
                    ? `${alertResult.created} alert(s) sent to admins and coaches.`
                    : alertResult.message}
                <button type="button" onClick={() => setAlertResult(null)} className="ml-auto text-xs font-semibold text-emerald-600 hover:text-emerald-700">Dismiss</button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <SkeletonTable rows={4} cols={4} />
          </div>
        ) : !centerId ? (
          <EmptyState
            icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            title="Select a center to view compliance alerts"
            description="Choose a center from the dropdown above to monitor logging, attendance, and progress compliance"
          />
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Missed Logging"
                sublabel="Last 24 hours"
                value={missedCount}
                color="amber"
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              />
              <StatCard
                label="Missing Attendance"
                sublabel="Today"
                value={attendanceCount}
                color="red"
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
              />
              <StatCard
                label="Overdue Progress"
                sublabel="14+ days stale"
                value={overdueCount}
                color="purple"
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Total Issues"
                sublabel="All categories"
                value={totalIssues}
                color={totalIssues === 0 ? "emerald" : "gray"}
                icon={totalIssues === 0 ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-100/80 p-1.5 shadow-sm">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                const count = tabCounts[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60"
                        : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
                    }`}
                  >
                    <Icon active={active} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count > 0 && (
                      <span className={`ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active
                          ? tab.color === "amber" ? "bg-amber-100 text-amber-700"
                          : tab.color === "red" ? "bg-red-100 text-red-700"
                          : "bg-purple-100 text-purple-700"
                          : "bg-gray-200 text-gray-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === "logging" && <MissedLoggingTab teachers={teachers} />}
            {activeTab === "attendance" && <MissingAttendanceTab data={compliance?.missingAttendance} />}
            {activeTab === "progress" && <OverdueProgressTab data={compliance?.overdueProgress} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

/* ── Missed Logging Tab ──────────────────────────────── */

function MissedLoggingTab({ teachers }) {
  if (teachers.length === 0) {
    return (
      <EmptyState
        icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        title="No teachers found"
        description="There are no teachers assigned to this center"
      />
    );
  }

  const flaggedTeachers = teachers.filter((t) => (t?.logs?.last24Hours || 0) === 0);
  const okTeachers = teachers.filter((t) => (t?.logs?.last24Hours || 0) > 0);

  return (
    <div className="space-y-4">
      {/* Flagged teachers first */}
      {flaggedTeachers.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-100 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-sm font-extrabold text-gray-900">Flagged Teachers</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{flaggedTeachers.length} missing logs</span>
          </div>
          <div className="divide-y divide-amber-100">
            {flaggedTeachers.map((t) => (
              <TeacherRow key={t.id} teacher={t} flagged />
            ))}
          </div>
        </div>
      )}

      {/* OK teachers */}
      {okTeachers.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-sm font-extrabold text-gray-900">Compliant Teachers</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{okTeachers.length} on track</span>
          </div>
          <div className="divide-y divide-gray-100">
            {okTeachers.map((t) => (
              <TeacherRow key={t.id} teacher={t} flagged={false} />
            ))}
          </div>
        </div>
      )}

      {/* All clear */}
      {flaggedTeachers.length === 0 && teachers.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-800">All teachers are logging</div>
            <div className="text-xs text-emerald-600">Every teacher has recorded activity in the last 24 hours</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherRow({ teacher, flagged }) {
  const last24 = teacher?.logs?.last24Hours || 0;
  const last7 = teacher?.logs?.last7Days || 0;

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50/60 ${flagged ? "hover:bg-amber-50/40" : ""}`}>
      {/* Avatar */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${flagged ? "bg-amber-500" : "bg-emerald-500"}`}>
        {(teacher.name || teacher.email || "?").charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-gray-900">{teacher.name || teacher.email}</div>
        <div className="text-xs text-gray-500">{teacher.email}</div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={`text-lg font-extrabold ${last24 === 0 ? "text-amber-600" : "text-gray-900"}`}>{last24}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">24h</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-gray-900">{last7}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">7 days</div>
        </div>
        <div className="w-24 text-right">
          {flagged ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
              Missing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              OK
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Missing Attendance Tab ──────────────────────────── */

function MissingAttendanceTab({ data }) {
  const children = data?.children || [];

  if (!data?.isWeekday) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
          <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
        <div>
          <div className="text-sm font-bold text-sky-800">Weekend / Holiday</div>
          <div className="text-xs text-sky-600">Attendance tracking is only checked on weekdays</div>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <div>
          <div className="text-sm font-bold text-emerald-800">All attendance recorded</div>
          <div className="text-xs text-emerald-600">Every child has an attendance record for today</div>
        </div>
      </div>
    );
  }

  // Group children by classroom
  const byClassroom = new Map();
  for (const c of children) {
    const name = c.classRoom?.name || "Unassigned";
    if (!byClassroom.has(name)) byClassroom.set(name, []);
    byClassroom.get(name).push(c);
  }
  const groups = [...byClassroom.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {groups.map(([className, kids]) => (
        <div key={className} className="rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-red-100 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
              <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>
            </div>
            <h3 className="text-sm font-extrabold text-gray-900">{className}</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{kids.length} missing</span>
          </div>
          <div className="divide-y divide-red-50">
            {kids.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-red-50/40">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                  {(c.firstName || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{c.firstName} {c.lastName || ""}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  No attendance
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Overdue Progress Tab ────────────────────────────── */

function OverdueProgressTab({ data }) {
  const children = data?.children || [];

  if (children.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <div>
          <div className="text-sm font-bold text-emerald-800">All progress up to date</div>
          <div className="text-xs text-emerald-600">No children have overdue progress records</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {children.map((item, idx) => {
        const ch = item.child;
        if (!ch) return null;
        const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim();
        const overdueGoals = item.overdueGoals || [];

        return (
          <div key={idx} className="rounded-2xl border border-purple-200 bg-white shadow-sm transition hover:shadow-md">
            {/* Child header */}
            <div className="flex items-center gap-3 border-b border-purple-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                {(ch.firstName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{name}</div>
                {ch.classRoom?.name && (
                  <div className="text-xs text-gray-500">{ch.classRoom.name}</div>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-800">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {overdueGoals.length} overdue
              </span>
            </div>

            {/* Goals */}
            <div className="divide-y divide-purple-50 px-5">
              {overdueGoals.slice(0, 5).map((g, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-[10px] font-bold text-purple-600">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800">{g.lessonTitle}</div>
                    <div className="text-[11px] text-gray-400">
                      {g.lastEntryAt ? (
                        <>
                          Last update: <span className="font-semibold text-purple-600">{new Date(g.lastEntryAt).toLocaleDateString()}</span>
                          <span className="ml-1 text-gray-400">({daysSince(g.lastEntryAt)} days ago)</span>
                        </>
                      ) : (
                        <span className="font-semibold text-red-500">Never updated</span>
                      )}
                    </div>
                  </div>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    !g.lastEntryAt ? "bg-red-100 text-red-600" : daysSince(g.lastEntryAt) > 21 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>
                    {g.lastEntryAt ? `${daysSince(g.lastEntryAt)}d` : "!"}
                  </div>
                </div>
              ))}
              {overdueGoals.length > 5 && (
                <div className="py-3 text-center text-xs text-gray-400">
                  +{overdueGoals.length - 5} more overdue goals
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Shared Components ──────────────────────────────── */

function StatCard({ label, sublabel, value, color, icon }) {
  const colors = {
    amber: "from-amber-50 to-amber-100/50 text-amber-600 border-amber-200/60",
    red: "from-red-50 to-red-100/50 text-red-600 border-red-200/60",
    purple: "from-purple-50 to-purple-100/50 text-purple-600 border-purple-200/60",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200/60",
    gray: "from-gray-50 to-gray-100/50 text-gray-600 border-gray-200/60",
  };
  const c = colors[color] || colors.gray;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
          <div className="mt-1 text-2xl font-extrabold">{String(value)}</div>
          {sublabel && <div className="mt-0.5 text-[10px] opacity-50">{sublabel}</div>}
        </div>
        <div className="opacity-30">{icon}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
    </div>
  );
}

/* ── Tab Icons ───────────────────────────────────────── */

function IconLogging({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-amber-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function IconAttendance({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-red-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconProgress({ active }) {
  return (
    <svg className={`h-4 w-4 ${active ? "text-purple-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ── Helpers ─────────────────────────────────────────── */

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
