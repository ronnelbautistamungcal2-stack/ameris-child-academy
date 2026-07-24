import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const TrendLineChart = dynamic(() => import("@/components/analytics/charts/TrendLineChart"), { ssr: false });
const MilestonesBarChart = dynamic(() => import("@/components/analytics/charts/MilestonesBarChart"), { ssr: false });

function defaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}
function defaultDateTo() {
  return new Date().toISOString().split("T")[0];
}

function gradeColor(g) {
  if (g == null) return "text-gray-400";
  if (g >= 80) return "text-emerald-700";
  if (g >= 60) return "text-amber-700";
  return "text-red-700";
}
function gradeBg(g) {
  if (g == null) return "bg-gray-50 border-gray-200 text-gray-500";
  if (g >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (g >= 60) return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-red-50 border-red-200 text-red-800";
}
function gradeLetter(g) {
  if (g == null) return "N/A";
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 70) return "C";
  if (g >= 60) return "D";
  return "F";
}

export default function TeacherSelfPerformanceReport({ centerId, centers, loading: centersLoading, setCenterId }) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, teacherId: "me", from: dateFrom, to: dateTo });
      const r = await apiJson(`/api/v1/analytics/teacher-perf-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [centerId, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const milestoneChartData = (report?.milestones?.byCategory || []).map((c) => ({
    category: c.category,
    "% Passed": c["% Passed"] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Selector + date filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900 mb-3">Teacher Performance Report</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={centersLoading}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select a center…</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {!centerId && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Select a center to view your performance report.</div>}
      {centerId && loading && <div className="rounded-2xl border border-gray-200 bg-white p-8"><SkeletonTable rows={5} cols={3} /></div>}

      {report && !loading && (
        <div className="space-y-4">
          {/* Overall Grade */}
          <div className={`rounded-2xl border p-6 ${gradeBg(report.overallGrade)}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-extrabold ${gradeColor(report.overallGrade)}`}>
                  {gradeLetter(report.overallGrade)}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">Overall Grade</div>
              </div>
              <div className="flex-1">
                <div className={`text-3xl font-extrabold ${gradeColor(report.overallGrade)}`}>
                  {report.overallGrade != null ? `${report.overallGrade}%` : "Insufficient Data"}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{report.teacher?.name || "—"}</div>
                <div className="text-xs text-gray-500">
                  {report.teacher?.classes?.length > 0 ? `Classes: ${report.teacher.classes.join(", ")}` : "No classes assigned"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Period: {new Date(report.dateRange.from).toLocaleDateString()} – {new Date(report.dateRange.to).toLocaleDateString()}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Formula: {report.gradeConfig.citizenshipWeight}% citizenship · {report.gradeConfig.evaluationWeight}% evaluation · {report.gradeConfig.checklistWeight}% checklist
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  { label: "Citizenship", val: report.citizenship?.normalized != null ? `${report.citizenship.normalized}%` : "—" },
                  { label: "Evaluation", val: report.evaluation?.normalized != null ? `${report.evaluation.normalized}%` : "—" },
                  { label: "Checklist", val: report.checklist?.pct != null ? `${report.checklist.pct}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/60 bg-white/50 px-3 py-2">
                    <div className="text-lg font-extrabold text-gray-800">{s.val}</div>
                    <div className="font-semibold text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Class Citizenship Grade + Milestones Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Class Citizenship Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average citizenship score of your class over time.</p>
              <div className="mt-1 text-xs text-gray-600">Class avg: <span className="font-bold text-gray-900">{report.citizenship?.avg != null ? report.citizenship.avg : "—"}</span></div>
              <div className="mt-3">
                <TrendLineChart
                  data={report.citizenship?.trend || []}
                  lines={[{ key: "score", label: "Class Avg Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Steps of progression completed — % passed by category.</p>
              <div className="mt-1 text-xs text-gray-600">Avg: <span className="font-bold text-gray-900">{report.milestones?.avgPct != null ? `${report.milestones.avgPct}%` : "—"}</span></div>
              <div className="mt-3">
                {milestoneChartData.length > 0
                  ? <MilestonesBarChart data={milestoneChartData} />
                  : <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>}
              </div>
            </div>
          </div>

          {/* Evaluation Grade + Checklist Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Evaluation Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Evaluation scores from admin — score over time.</p>
              <div className="mt-1 text-xs text-gray-600">Most recent: <span className="font-bold text-gray-900">{report.evaluation?.mostRecentScore != null ? `${report.evaluation.mostRecentScore}/10` : "—"}</span></div>
              <div className="mt-3">
                <TrendLineChart
                  data={report.evaluation?.trend || []}
                  lines={[{ key: "score", label: "Evaluation Score", color: "#7c3aed" }]}
                  yDomain={[0, 10]}
                  yLabel="Score"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Checklist Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Percentage of assigned daily checklist items completed.</p>
              <div className="mt-4 flex items-center gap-4">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-extrabold text-2xl ${report.checklist?.pct != null ? gradeBg(report.checklist.pct) : "border-gray-200 text-gray-400"}`}>
                  {report.checklist?.pct != null ? `${report.checklist.pct}%` : "—"}
                </div>
                <div className="text-sm text-gray-600">
                  <div>{report.checklist?.completedCount ?? 0} items completed</div>
                  <div className="text-xs text-gray-400">out of ~{report.checklist?.assignedCount ?? 0} assigned × days</div>
                </div>
              </div>
            </div>
          </div>

          {/* Commendations + Citations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Commendations</div>
              {(report.commendations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.commendations.map((c) => (
                      <div key={c.id} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <div className="text-sm text-emerald-900">{c.text}</div>
                        <div className="text-xs text-emerald-600">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Citations</div>
              {(report.citations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.citations.map((c) => (
                      <div key={c.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                        <div className="text-sm text-red-900">{c.text}</div>
                        <div className="text-xs text-red-500">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* HR */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">HR</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Hours Worked", value: report.hr?.hoursWorked ?? "—", color: "bg-sky-50 text-sky-800 border-sky-200" },
                { label: "Lates", value: report.hr?.lates ?? "—", color: "bg-amber-50 text-amber-800 border-amber-200" },
                { label: "Absences", value: report.hr?.absences ?? "—", color: "bg-red-50 text-red-800 border-red-200" },
                { label: "PTO Available (hrs)", value: report.hr?.ptoAvailable ?? "—", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                { label: "UTO Available (hrs)", value: report.hr?.utoAvailable ?? "—", color: "bg-gray-50 text-gray-800 border-gray-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <div className="text-2xl font-extrabold">{String(s.value)}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Training Hours */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Training Hours</div>
            <p className="mt-0.5 text-xs text-gray-500">From training hours recorded in this period.</p>
            <div className="mt-3 text-3xl font-extrabold text-sky-700">{report.training?.totalHours ?? 0} hrs</div>
            {(report.training?.logs?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-1.5">
                {report.training.logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-gray-800">{l.topic}</span>
                    <span className="text-gray-500">{l.hours} hrs · {new Date(l.date).toLocaleDateString()}</span>
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
