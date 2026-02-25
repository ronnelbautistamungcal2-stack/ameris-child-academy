import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const TABS = [
  { key: "logging", label: "Missed Logging" },
  { key: "attendance", label: "Missing Attendance" },
  { key: "progress", label: "Overdue Progress" },
];

export default function ComplianceAlerts() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [activeTab, setActiveTab] = useState("logging");

  // Legacy summary data (missed logging)
  const [summary, setSummary] = useState(null);
  // Enhanced compliance check data
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

  return (
    <AdminLayout title="Compliance Alerts">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">
              Compliance Alerts
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Monitor missed logging, attendance gaps, and overdue progress updates.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={sendAlerts}
              disabled={sendingAlerts || !centerId}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingAlerts ? "Sending..." : "Send Alerts"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {alertResult && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {alertResult.skipped
              ? "Alerts already generated for today."
              : alertResult.created
                ? `${alertResult.created} alert(s) sent to admins and coaches.`
                : alertResult.message}
          </div>
        )}

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading...</div>
        ) : !centerId ? (
          <div className="mt-4 text-sm text-gray-600">
            Choose a center to view compliance alerts.
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Missed Logging (24h)"
                value={compliance?.missedLogging?.count ?? flagged.length}
                color="amber"
              />
              <Stat
                label="Missing Attendance"
                value={compliance?.missingAttendance?.count ?? 0}
                color="red"
              />
              <Stat
                label="Overdue Progress"
                value={compliance?.overdueProgress?.count ?? 0}
                color="purple"
              />
            </div>

            {/* Tabs */}
            <div className="mt-5 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "px-4 py-2.5 text-sm font-semibold transition",
                    activeTab === tab.key
                      ? "border-b-2 border-sky-600 text-sky-700"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="mt-4">
              {activeTab === "logging" && (
                <MissedLoggingTab teachers={teachers} />
              )}
              {activeTab === "attendance" && (
                <MissingAttendanceTab data={compliance?.missingAttendance} />
              )}
              {activeTab === "progress" && (
                <OverdueProgressTab data={compliance?.overdueProgress} />
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function MissedLoggingTab({ teachers }) {
  return (
    <div className="overflow-auto rounded-2xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Teacher</th>
            <th className="px-4 py-3 text-left">Last 24 hours</th>
            <th className="px-4 py-3 text-left">Last 7 days</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => {
            const last24 = t?.logs?.last24Hours || 0;
            const last7 = t?.logs?.last7Days || 0;
            const isFlagged = last24 === 0;
            return (
              <tr key={t.id} className="border-t border-gray-200">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">
                    {t.name || t.email}
                  </div>
                  <div className="text-xs text-gray-500">{t.email}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{last24}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{last7}</td>
                <td className="px-4 py-3">
                  {isFlagged ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-800">
                      Missing logs
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-extrabold text-emerald-800">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {teachers.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-sm text-gray-600" colSpan={4}>
                No teachers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MissingAttendanceTab({ data }) {
  const children = data?.children || [];

  if (!data?.isWeekday) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Attendance tracking is only checked on weekdays.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Child</th>
            <th className="px-4 py-3 text-left">Classroom</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {children.map((c) => (
            <tr key={c.id} className="border-t border-gray-200">
              <td className="px-4 py-3 font-semibold text-gray-900">
                {c.firstName} {c.lastName || ""}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {c.classRoom?.name || "Unassigned"}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-extrabold text-red-800">
                  No attendance
                </span>
              </td>
            </tr>
          ))}
          {children.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-sm text-gray-600" colSpan={3}>
                All children have attendance records for today.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OverdueProgressTab({ data }) {
  const children = data?.children || [];

  return (
    <div className="overflow-auto rounded-2xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Child</th>
            <th className="px-4 py-3 text-left">Overdue Goals</th>
            <th className="px-4 py-3 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {children.map((item, idx) => (
            <tr key={idx} className="border-t border-gray-200">
              <td className="px-4 py-3 font-semibold text-gray-900">
                {item.child?.firstName} {item.child?.lastName || ""}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-extrabold text-purple-800">
                  {item.overdueGoals?.length || 0} goal(s)
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  {(item.overdueGoals || []).slice(0, 3).map((g, i) => (
                    <div key={i} className="text-xs text-gray-600">
                      {g.lessonTitle}
                      {g.lastEntryAt && (
                        <span className="ml-1 text-gray-400">
                          (last: {new Date(g.lastEntryAt).toLocaleDateString()})
                        </span>
                      )}
                      {!g.lastEntryAt && (
                        <span className="ml-1 text-gray-400">(never updated)</span>
                      )}
                    </div>
                  ))}
                  {(item.overdueGoals?.length || 0) > 3 && (
                    <div className="text-xs text-gray-400">
                      +{item.overdueGoals.length - 3} more
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {children.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-sm text-gray-600" colSpan={3}>
                No overdue progress records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color = "gray" }) {
  const colorMap = {
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
    purple: "border-purple-200 bg-purple-50",
    gray: "border-gray-200 bg-white",
  };
  return (
    <div className={["rounded-2xl border p-4", colorMap[color] || colorMap.gray].join(" ")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-gray-900">
        {String(value)}
      </div>
    </div>
  );
}
