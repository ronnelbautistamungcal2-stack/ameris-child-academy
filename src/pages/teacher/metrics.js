import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function TeacherMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const metrics = await apiJson("/api/v1/metrics/me");
        setData(metrics);
      } catch (err) {
        setError(err.message || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const trainingCategories = useMemo(() => {
    return Object.entries(data?.training?.byCategory || {}).sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <TeacherLayout title="Metrics & Reports">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50/70 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-700">
                Performance workspace
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900">
                Metrics that support coaching, reviews, and classroom follow-through
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This view now combines activity logging, progress outcomes, training history, evaluations, and staff attendance.
              </p>
            </div>

            {data?.generatedAt ? (
              <div className="rounded-[1.5rem] border border-white/80 bg-white/90 px-4 py-3 text-sm text-gray-600 shadow-sm">
                Synced {formatDate(data.generatedAt)}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : data ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Activities Today" value={data.activities?.today ?? 0} hint="Recorded by you" tone="sky" />
              <MetricCard label="Active Days" value={data.activities?.activeDaysLast30 ?? 0} hint="Last 30 days" tone="emerald" />
              <MetricCard label="Training Hours" value={data.training?.totalHours ?? 0} hint="Rolling 12 months" tone="amber" />
              <MetricCard label="Goal Completion" value={`${data.progress?.completionRate ?? 0}%`} hint="Completed + passed" tone="rose" />
            </div>
          ) : null}
        </section>

        {loading ? null : data ? (
          <>
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <Panel
                title="Activity logging"
                description="Use this to spot consistency, pace, and whether the classroom log volume is holding up over time."
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MiniMetric label="This week" value={data.activities?.week ?? 0} />
                  <MiniMetric label="Last 30 days" value={data.activities?.last30Days ?? 0} />
                  <MiniMetric label="Avg / active day" value={data.activities?.averagePerActiveDay ?? 0} />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-gray-200 bg-gray-50/80 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">
                    Activity mix
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(data.activities?.byType || {}).length ? (
                      Object.entries(data.activities.byType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between rounded-2xl border border-white bg-white px-3 py-2 text-sm"
                          >
                            <span className="font-semibold text-gray-700">{type.replaceAll("_", " ")}</span>
                            <span className="font-extrabold text-gray-900">{count}</span>
                          </div>
                        ))
                    ) : (
                      <EmptyLine text="No recent activity logs yet." />
                    )}
                  </div>
                </div>
              </Panel>

              <Panel
                title="Access scope"
                description="Useful during review cycles to understand the size of the teacher’s current operational footprint."
              >
                <div className="grid grid-cols-1 gap-3">
                  <ScopeRow label="Centers" value={data.access?.centers ?? 0} />
                  <ScopeRow label="Classes" value={data.access?.classes ?? 0} />
                  <ScopeRow label="Children" value={data.access?.children ?? 0} />
                </div>
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel
                title="Progress outcomes"
                description="This summarizes the current goal pipeline for the children in the teacher’s classroom scope."
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <MiniMetric label="Total" value={data.progress?.totalGoals ?? 0} />
                  <MiniMetric label="In progress" value={data.progress?.inProgress ?? 0} />
                  <MiniMetric label="Completed" value={data.progress?.completed ?? 0} />
                  <MiniMetric label="Passed" value={data.progress?.passed ?? 0} />
                  <MiniMetric label="Failed" value={data.progress?.failed ?? 0} tone="rose" />
                </div>
              </Panel>

              <Panel
                title="Attendance"
                description="Operational reliability can be discussed alongside classroom and training performance."
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <MiniMetric label="Records" value={data.attendance?.totalRecords ?? 0} />
                  <MiniMetric label="Present" value={data.attendance?.present ?? 0} tone="emerald" />
                  <MiniMetric label="Late" value={data.attendance?.late ?? 0} tone="amber" />
                  <MiniMetric label="Absent" value={data.attendance?.absent ?? 0} tone="rose" />
                  <MiniMetric label="Late mins" value={data.attendance?.totalLateMinutes ?? 0} />
                </div>
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel
                title="Training"
                description="Recent development work is broken down by category so coaching conversations can stay concrete."
              >
                <div className="space-y-3">
                  {trainingCategories.length ? (
                    trainingCategories.map(([category, hours]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-extrabold text-gray-900">{category}</div>
                          <div className="text-xs text-gray-500">Accumulated hours</div>
                        </div>
                        <div className="text-lg font-black text-gray-900">{hours}</div>
                      </div>
                    ))
                  ) : (
                    <EmptyLine text="No training records have been logged yet." />
                  )}
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-gray-200 bg-gray-50/80 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">
                    Recent entries
                  </div>
                  <div className="mt-3 space-y-2">
                    {data.training?.recent?.length ? (
                      data.training.recent.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-white bg-white px-4 py-3">
                          <div className="text-sm font-extrabold text-gray-900">{entry.topic}</div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>{entry.category}</span>
                            <span>{entry.hours}h</span>
                            <span>{formatDate(entry.date)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyLine text="No recent training entries." />
                    )}
                  </div>
                </div>
              </Panel>

              <Panel
                title="Evaluations"
                description="The most recent review signal stays visible alongside average scoring trends."
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <MiniMetric label="Evaluations" value={data.evaluations?.count ?? 0} />
                  <MiniMetric label="Average score" value={data.evaluations?.averageScore ?? "-"} tone="sky" />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-gray-200 bg-gray-50/80 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">
                    Latest review
                  </div>
                  {data.evaluations?.latest ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <ReviewRow label="Period" value={data.evaluations.latest.period} />
                      <ReviewRow label="Status" value={data.evaluations.latest.status} />
                      <ReviewRow label="Score" value={data.evaluations.latest.overallScore ?? "-"} />
                      <ReviewRow label="Created" value={formatDate(data.evaluations.latest.createdAt)} />
                      <ReviewRow
                        label="Acknowledged"
                        value={formatDate(data.evaluations.latest.teacherAcknowledgedAt)}
                      />
                    </div>
                  ) : (
                    <EmptyLine text="No evaluations are available yet." />
                  )}
                </div>
              </Panel>
            </section>
          </>
        ) : null}
      </div>
    </TeacherLayout>
  );
}

function MetricCard({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-100 bg-sky-50/90",
    emerald: "border-emerald-100 bg-emerald-50/90",
    amber: "border-amber-100 bg-amber-50/90",
    rose: "border-rose-100 bg-rose-50/90",
  };

  return (
    <div className={`rounded-[1.6rem] border p-4 ${tones[tone] || tones.sky}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{hint}</div>
    </div>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-[1.8rem] border border-gray-200 bg-white/90 p-5 shadow-sm">
      <div>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniMetric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-gray-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    sky: "border-sky-200 bg-sky-50",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.gray}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-gray-900">{value}</div>
    </div>
  );
}

function ScopeRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
      <span className="text-sm font-semibold text-gray-600">{label}</span>
      <span className="text-lg font-black text-gray-900">{value}</span>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white px-4 py-3">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="font-extrabold text-gray-900">{value}</span>
    </div>
  );
}

function EmptyLine({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
      {text}
    </div>
  );
}
