import { useEffect, useMemo, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
} from "@/components/coach/CoachPage";
import { apiJson } from "@/lib/api";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function CoachReports() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const centerRows = await apiJson("/api/v1/centers");
        const rows = Array.isArray(centerRows) ? centerRows : [];
        setCenters(rows);
        if (rows.length === 1) {
          setCenterId(rows[0].id);
        }
      } catch (err) {
        setError(err.message || "Failed to load centers");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId && centers.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (centerId) params.set("centerId", centerId);
        if (teacherId) params.set("teacherId", teacherId);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const report = await apiJson(`/api/v1/coach/reports?${params.toString()}`);
        setData(report);
      } catch (err) {
        setError(err.message || "Failed to load coach reports");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, teacherId, dateFrom, dateTo, centers.length]);

  const teachers = useMemo(() => data?.teachersReport || [], [data]);

  return (
    <CoachLayout title="Reports">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Reporting"
          title="Coach reporting is now backed by live observation, follow-up, training, and evaluation data."
          description="Filter one center at a time to see which teachers need attention, which coaching work is closing, and where trendlines are strengthening or drifting."
          meta={
            <>
              <CoachBadge tone="amber">Observations</CoachBadge>
              <CoachBadge tone="sky">Follow-ups</CoachBadge>
              <CoachBadge tone="emerald">Training</CoachBadge>
              <CoachBadge tone="rose">Logging risk</CoachBadge>
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3">
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={coachInputClass}>
                <option value="">All accessible centers</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={coachInputClass}>
                <option value="">All teachers</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name || teacher.email}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={coachInputClass}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={coachInputClass}
              />
            </div>
          }
          stats={
            <>
              <CoachMetricCard
                label="Teachers"
                value={loading ? "..." : data?.summary?.teachers ?? 0}
                hint="Included in the current slice"
                tone="sky"
                icon={<PeopleIcon />}
              />
              <CoachMetricCard
                label="Observations"
                value={loading ? "..." : data?.summary?.observations ?? 0}
                hint="Recorded in range"
                tone="amber"
                icon={<ObservationIcon />}
              />
              <CoachMetricCard
                label="Open Follow-ups"
                value={loading ? "..." : data?.summary?.openFollowUps ?? 0}
                hint="Still active"
                tone="rose"
                icon={<FollowUpIcon />}
              />
              <CoachMetricCard
                label="Training Hours"
                value={loading ? "..." : data?.summary?.trainingHours ?? 0}
                hint="Professional development logged"
                tone="emerald"
                icon={<TrainingIcon />}
              />
            </>
          }
        />

        {error ? (
          <CoachPanel title="Report error" description={error} tone="rose" />
        ) : null}

        <CoachPanel
          title="Activity summary"
          description="High-level child activity volume for the current report slice, with a quick read on what is being logged most often."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryStat label="Today" value={loading ? "..." : data?.summary?.activitiesToday ?? 0} />
            <SummaryStat label="Last 7 days" value={loading ? "..." : data?.summary?.activitiesWeek ?? 0} />
            <SummaryStat label="Last 30 days" value={loading ? "..." : data?.summary?.activitiesMonth ?? 0} />
            <SummaryStat
              label="Top type"
              value={loading ? "..." : topActivityType(data?.summary?.activityByType)}
            />
          </div>

          {Object.entries(data?.summary?.activityByType || {}).length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.summary.activityByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800"
                  >
                    {type.replaceAll("_", " ")}: {count}
                  </span>
                ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-gray-500">
              No activity data is available for the current filters.
            </div>
          )}
        </CoachPanel>

        <CoachPanel
          title="Teacher snapshot"
          description="This table combines observation quality, coaching follow-through, training volume, evaluations, and logging risk in one place."
        >
          {loading ? (
            <div className="text-sm text-gray-500">Loading report data...</div>
          ) : teachers.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                    <th className="px-3 py-3">Teacher</th>
                    <th className="px-3 py-3">Observation Avg</th>
                    <th className="px-3 py-3">Open / Overdue</th>
                    <th className="px-3 py-3">Training</th>
                    <th className="px-3 py-3">Latest Eval</th>
                    <th className="px-3 py-3">Logs 24h / 7d</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b border-slate-100 text-gray-700">
                      <td className="px-3 py-3 align-top">
                        <div className="font-bold text-gray-900">{teacher.name || teacher.email}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {teacher.classrooms.length
                            ? teacher.classrooms.map((room) => room.name).join(", ")
                            : "No classroom assignments"}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-extrabold text-gray-900">
                          {teacher.avgObservationScore ?? "-"}
                        </div>
                        <div className="text-xs text-gray-500">{teacher.observationCount} observations</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-extrabold text-gray-900">
                          {teacher.openFollowUps} / {teacher.overdueFollowUps}
                        </div>
                        <div className="text-xs text-gray-500">
                          {teacher.completedFollowUps} completed
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-extrabold text-gray-900">{teacher.trainingHours}h</div>
                        <div className="text-xs text-gray-500">
                          Last {formatDate(teacher.lastTrainingAt)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {teacher.latestEvaluation ? (
                          <>
                            <div className="font-extrabold text-gray-900">
                              {teacher.latestEvaluation.overallScore ?? "-"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {teacher.latestEvaluation.status} · {teacher.latestEvaluation.period}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">No evaluation yet</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-extrabold text-gray-900">
                          {teacher.logsLast24Hours} / {teacher.logsLast7Days}
                        </div>
                        <div className="text-xs text-gray-500">
                          {teacher.logsLast24Hours === 0 ? "Needs logging follow-up" : "Current"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No teacher data available for the selected filters.</div>
          )}
        </CoachPanel>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
          <CoachPanel
            title="Trendlines"
            description="Simple counts by week and month so coaching conversations can focus on movement, not just totals."
          >
            <div className="space-y-4">
              <TrendBlock
                title="Observations by week"
                rows={(data?.trends?.observationsByWeek || []).map((row) => ({
                  label: row.week,
                  value: row.count,
                }))}
              />
              <TrendBlock
                title="Training by month"
                rows={(data?.trends?.trainingByMonth || []).map((row) => ({
                  label: row.month,
                  value: row.hours,
                }))}
              />
              <TrendBlock
                title="Follow-ups by status"
                rows={(data?.trends?.followUpsByStatus || []).map((row) => ({
                  label: row.status,
                  value: row.count,
                }))}
              />
            </div>
          </CoachPanel>

          <CoachPanel
            title="Watchlist"
            description="Items worth reviewing first when you open the next coaching cycle."
            tone="rose"
          >
            <div className="space-y-4">
              <WatchSection
                title="Overdue follow-ups"
                rows={(data?.watchlist?.overdueFollowUps || []).map((row) => ({
                  id: row.id,
                  title: row.title,
                  meta: `${row.priority} priority · due ${formatDate(row.dueDate)}`,
                }))}
              />
              <WatchSection
                title="Lowest observation scores"
                rows={(data?.watchlist?.lowScoringObservations || []).map((row) => ({
                  id: row.id,
                  title: `${row.teacherName} · ${row.score ?? "-"}`,
                  meta: `${row.type} · ${formatDate(row.date)}`,
                }))}
              />
            </div>
          </CoachPanel>
        </div>
      </div>
    </CoachLayout>
  );
}

function topActivityType(byType) {
  const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "None";
  return entries[0][0].replaceAll("_", " ");
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-gray-900">{value}</div>
    </div>
  );
}

function TrendBlock({ title, rows }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
      <div className="text-sm font-black text-gray-900">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <span className="text-gray-600">{row.label}</span>
              <span className="font-extrabold text-gray-900">{row.value}</span>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-gray-500">
            No data in this range.
          </div>
        )}
      </div>
    </div>
  );
}

function WatchSection({ title, rows }) {
  return (
    <div className="rounded-[1.4rem] border border-rose-100 bg-white/80 p-4">
      <div className="text-sm font-black text-gray-900">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-3">
              <div className="text-sm font-extrabold text-gray-900">{row.title}</div>
              <div className="mt-1 text-xs text-gray-500">{row.meta}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-gray-500">
            Nothing urgent right now.
          </div>
        )}
      </div>
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1" />
      <circle cx="10" cy="7" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 20v-1a4 4 0 00-3-3.87M16 4.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ObservationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25A2.25 2.25 0 1012 9.75a2.25 2.25 0 000 4.5z" />
    </svg>
  );
}

function FollowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TrainingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0112 20.055a12.083 12.083 0 01-6.16-9.477L12 14z" />
    </svg>
  );
}
