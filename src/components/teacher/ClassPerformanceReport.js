import { SkeletonTable } from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// Lazy-load charts
const TrendLineChart = dynamic(() => import("@/components/analytics/charts/TrendLineChart"), { ssr: false });
const MilestonesBarChart = dynamic(() => import("@/components/analytics/charts/MilestonesBarChart"), { ssr: false });

function defaultDateFrom() {
  const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0];
}
function defaultDateTo() { return new Date().toISOString().split("T")[0]; }

const CLASS_ACTIVITY_ICONS = {
  NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
  DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
  ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
  TASK_CHECKLIST: "✅", TOILETING: "🚽", OTHER: "📝",
};

function behaviorTypeLabel(type) {
  if (!type) return "—";
  const LABELS = {
    OTHER: "Other", HITTING: "Hitting", BITING: "Biting", KICKING: "Kicking",
    SCRATCHING: "Scratching", PUSHING: "Pushing", THROWING: "Throwing",
    TANTRUM: "Tantrum", NOT_FOLLOWING_DIRECTIONS: "Not Following Directions",
    RESPECT: "Respect", SHARING: "Sharing", HELPING: "Helping",
    EMPATHY: "Empathy", COMMUNICATION: "Communication",
  };
  return LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClassPerformanceReport() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedIPP, setExpandedIPP] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    if (!centerId) { setClasses([]); setClassId(""); return; }
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((r) => {
        const arr = Array.isArray(r) ? r : [];
        setClasses(arr);
        // Auto-select if teacher has only one class
        if (arr.length === 1) setClassId(arr[0].id);
      })
      .catch(() => {});
  }, [centerId]);

  // Load the centers this teacher can report on
  useEffect(() => {
    (async () => {
      setLoadingCenters(true);
      try {
        const c = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(c) ? c : []);
      } catch {
        setCenters([]);
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  const loadReport = useCallback(async () => {
    if (!classId || !centerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId, centerId, from: dateFrom, to: dateTo });
      const r = await apiJson(`/api/v1/analytics/class-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [classId, centerId, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const milestoneChartData = (report?.milestonesGrade || []).map((c) => ({
    category: c.category,
    "% Passed": c["% Passed"] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900 mb-3">Class Performance Report</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loadingCenters}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select a center…</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Classroom</div>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!centerId || classes.length === 0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Choose a classroom…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date</div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">End Date</div>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
        </div>
      </div>

      {!centerId && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Select a center to get started.</div>}
      {centerId && !classId && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Select a classroom to view the class performance report.</div>}
      {classId && loading && <div className="rounded-2xl border border-gray-200 bg-white p-8"><SkeletonTable rows={5} cols={3} /></div>}

      {report && !loading && (
        <div className="space-y-4">

          {/* Class Citizenship Grade + Milestones Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Class Citizenship Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average citizenship score of the class over time.</p>
              {report.citizenshipAvg != null && (
                <div className="mt-1 text-xs text-gray-600">Class avg: <span className="font-bold text-gray-900">{report.citizenshipAvg} / 4</span></div>
              )}
              <div className="mt-3">
                <TrendLineChart
                  data={report.citizenshipTrend || []}
                  lines={[{ key: "score", label: "Class Avg Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Steps of progression completed — % passed by category.</p>
              {report.milestonesAvgPct != null && (
                <div className="mt-1 text-xs text-gray-600">Class avg: <span className="font-bold text-gray-900">{report.milestonesAvgPct}%</span></div>
              )}
              <div className="mt-3">
                {milestoneChartData.length > 0
                  ? <MilestonesBarChart data={milestoneChartData} />
                  : <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>}
              </div>
            </div>
          </div>

          {/* Course Correction Logs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Course Correction Logs</div>
            <p className="mt-0.5 text-xs text-gray-500">Course Correction activity entries at level 2 or level 3.</p>
            {(report.citizenshipLogs?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No Course Correction logs at level 2 or 3 in this period.</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Level</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.citizenshipLogs.map((log) => (
                      <>
                        <tr key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                          <td className="px-4 py-2 font-semibold text-sky-700">{log.childName}</td>
                          <td className="px-4 py-2 text-gray-700">{behaviorTypeLabel(log.type)}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.level === "3" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>Level {log.level}</span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                        </tr>
                        {expandedLog === log.id && log.notes && (
                          <tr key={`${log.id}-d`}>
                            <td colSpan={4} className="bg-amber-50 px-4 py-2 text-xs text-amber-900">
                              <span className="font-semibold">Note: </span>{log.notes}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Red Flags */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Red Flags</div>
            <p className="mt-0.5 text-xs text-gray-500">Active flags for children in this class.</p>
            {(report.redFlags?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">None</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Alert</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.redFlags.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{f.childName}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {f.snapshot?.type === "INDIVIDUAL_PROGRESS_PLAN"
                            ? `IPP: ${f.snapshot.planTitle || "Plan"}`
                            : f.flagKey?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Flag"}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class IPP Plans */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Class IPP Plans</div>
            <p className="mt-0.5 text-xs text-gray-500">Open Individual Progress Plans for children in this class.</p>
            {(report.ippPlans?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">None</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Title</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.ippPlans.map((plan) => (
                      <>
                        <tr key={plan.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedIPP(expandedIPP === plan.id ? null : plan.id)}>
                          <td className="px-4 py-2 font-semibold text-sky-700">{plan.childName}</td>
                          <td className="px-4 py-2 font-semibold text-gray-900">{plan.title}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(plan.startDate || plan.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-xs text-sky-600">{expandedIPP === plan.id ? "Hide" : "Details"}</td>
                        </tr>
                        {expandedIPP === plan.id && (
                          <tr key={`${plan.id}-d`}>
                            <td colSpan={4} className="bg-sky-50 px-4 py-3 text-xs">
                              {plan.description && <div className="mb-1"><span className="font-semibold text-gray-700">Description: </span><span className="text-gray-600">{plan.description}</span></div>}
                              {plan.teacherTactics && <div className="mb-1"><span className="font-semibold text-gray-700">Teacher Tactics: </span><span className="text-gray-600">{plan.teacherTactics}</span></div>}
                              {(plan.goals || []).length > 0 && (
                                <div className="space-y-1">
                                  {plan.goals.map((g) => (
                                    <div key={g.id} className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 font-semibold text-xs ${g.status === "MET" ? "bg-emerald-100 text-emerald-700" : g.status === "NOT_MET" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{g.status?.replace(/_/g, " ")}</span>
                                      <span className="text-gray-700">{g.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class Daily Logs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Class Daily Logs</div>
            <p className="mt-0.5 text-xs text-gray-500">Activity logs for all children — similar to Procare.</p>
            {(report.activityLogs?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No activity logs in this period.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {report.activityLogs.map((child) => (
                  <div key={child.childId} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-xs font-bold text-white flex-shrink-0">
                        {(child.childName || "?")[0].toUpperCase()}
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{child.childName}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {child.logs.slice(0, 12).map((log) => (
                          <span key={log.id} title={`${log.type.replace(/_/g, " ")} — ${new Date(log.createdAt).toLocaleDateString()}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base cursor-default">
                            {CLASS_ACTIVITY_ICONS[log.type] || "📄"}
                          </span>
                        ))}
                        {child.logs.length > 12 && (
                          <span className="flex h-8 items-center rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-500">+{child.logs.length - 12}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
