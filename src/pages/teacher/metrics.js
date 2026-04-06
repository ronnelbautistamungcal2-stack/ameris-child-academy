import Link from "next/link";
import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function fmtPct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function humanize(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function daysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function share(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(total || 1)) * 100)));
}

export default function TeacherMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      setData(await apiJson("/api/v1/metrics/me"));
    } catch (err) {
      setData(null);
      setError(err.message || "Failed to load metrics");
      setErrorCode(err.code || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const activityMix = useMemo(() => {
    const entries = Object.entries(data?.activities?.byType || {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
    return entries.map(([label, count]) => ({ label: humanize(label), count, width: share(count, total) }));
  }, [data]);

  const trainingMix = useMemo(() => {
    const entries = Object.entries(data?.training?.byCategory || {}).sort((a, b) => b[1] - a[1]);
    return entries.map(([label, hours]) => ({
      label,
      hours,
      width: share(hours, data?.training?.totalHours ?? 0),
    }));
  }, [data]);

  const focusCards = useMemo(() => {
    if (!data) return [];
    const trainingAge = daysSince(data.training?.lastCompletedAt);
    const activeDays = data.activities?.activeDaysLast30 ?? 0;
    const late = data.attendance?.late ?? 0;
    const absent = data.attendance?.absent ?? 0;

    return [
      {
        title: "Logging consistency",
        tone: activeDays >= 18 ? "emerald" : activeDays >= 10 ? "sky" : "amber",
        status: activeDays >= 18 ? "Strong" : activeDays >= 10 ? "Steady" : "Watch",
        value: `${activeDays}/30 days`,
        detail: `${data.activities?.week ?? 0} logs this week and ${fmtNum(data.activities?.averagePerActiveDay ?? 0)} per active day.`,
        href: "/teacher/logs",
      },
      {
        title: "Training momentum",
        tone: trainingAge === null ? "rose" : trainingAge <= 90 ? "emerald" : "amber",
        status: trainingAge === null ? "Missing" : trainingAge <= 90 ? "Current" : "Monitor",
        value: `${fmtNum(data.training?.totalHours ?? 0)}h`,
        detail: trainingAge === null ? "No training logged yet." : `Last completed ${trainingAge === 0 ? "today" : `${trainingAge} days ago`}.`,
        href: "/teacher/training",
      },
      {
        title: "Attendance reliability",
        tone: absent === 0 && late <= 1 ? "emerald" : absent <= 1 && late <= 3 ? "amber" : "rose",
        status: absent === 0 && late <= 1 ? "Stable" : absent <= 1 && late <= 3 ? "Monitor" : "Watch",
        value: `${late} late / ${absent} absent`,
        detail: `${data.attendance?.totalLateMinutes ?? 0} late minutes in the current reporting window.`,
        href: "/teacher/time-off",
      },
    ];
  }, [data]);

  return (
    <TeacherLayout title="Metrics & Reports">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/30">
          <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-sky-100/80 blur-3xl dark:bg-sky-900/35" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-100/80 blur-3xl dark:bg-emerald-900/25" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
                Performance workspace
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-[2.35rem]">
                Metrics that support coaching, reviews, and classroom follow-through
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                A cleaner snapshot of your activity, goal progress, training history, evaluations, and attendance.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-4 text-white sm:min-w-[320px]">
              <HeroStat label="Children" value={fmtNum(data?.access?.children ?? 0)} hint={`${fmtNum(data?.access?.classes ?? 0)} classes`} />
              <HeroStat label="Latest training" value={data?.training?.lastCompletedAt ? fmtDate(data.training.lastCompletedAt) : "None"} hint={data?.training?.lastCompletedAt ? `${daysSince(data.training.lastCompletedAt) ?? 0} days ago` : "No record yet"} />
              <HeroStat label="Latest review" value={data?.evaluations?.latest ? humanize(data.evaluations.latest.status) : "Pending"} hint={data?.evaluations?.latest ? fmtDate(data.evaluations.latest.createdAt) : "No review history"} />
              <HeroStat label="Last sync" value={data?.generatedAt ? fmtDate(data.generatedAt) : "-"} hint="Live personal metrics" />
            </div>
          </div>

          {errorCode === "FEATURE_DISABLED" ? (
            <Notice tone="amber" title="Teacher metrics are not enabled for your center">
              Ask an admin to open Admin &gt; Facilities &gt; Subscriptions, make the center subscription active, and enable Teacher Metrics.
              <RetryButton onClick={loadMetrics} label="Refresh status" />
            </Notice>
          ) : error ? (
            <Notice tone="rose" title="Metrics could not be loaded">
              {error}
              <RetryButton onClick={loadMetrics} label="Try again" />
            </Notice>
          ) : loading ? (
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)}
            </div>
          ) : data ? (
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TopCard label="Activities Today" value={fmtNum(data.activities?.today ?? 0)} hint={`${fmtNum(data.activities?.week ?? 0)} this week`} tone="sky" />
              <TopCard label="Active Days" value={fmtNum(data.activities?.activeDaysLast30 ?? 0)} hint="Last 30 days" tone="emerald" />
              <TopCard label="Training Hours" value={fmtNum(data.training?.totalHours ?? 0)} hint={`${fmtNum(data.training?.entries ?? 0)} entries`} tone="amber" />
              <TopCard label="Goal Completion" value={fmtPct(data.progress?.completionRate ?? 0)} hint={`${fmtNum(data.progress?.totalGoals ?? 0)} goals tracked`} tone="violet" />
            </div>
          ) : null}
        </section>

        {loading || error || !data ? null : (
          <>
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Panel title="Focus areas" description="The fastest way to see what needs attention before a check-in or review.">
                <div className="space-y-3">
                  {focusCards.map((item) => (
                    <FocusCard key={item.title} item={item} />
                  ))}
                </div>
              </Panel>

              <Panel title="Quick actions" description="Jump from the numbers to the place where you can update them.">
                <div className="grid grid-cols-1 gap-2">
                  <QuickLink href="/teacher/logs" label="Add classroom activity log" />
                  <QuickLink href="/teacher/training" label="Open performance and training" />
                  <QuickLink href="/teacher/time-off" label="Check time off and attendance" />
                  <QuickLink href="/teacher/classroom" label="Open my classroom" />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Scope</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MiniStat label="Centers" value={fmtNum(data.access?.centers ?? 0)} />
                    <MiniStat label="Classes" value={fmtNum(data.access?.classes ?? 0)} />
                    <MiniStat label="Children" value={fmtNum(data.access?.children ?? 0)} />
                  </div>
                </div>
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel title="Activity and progress" description="See classroom logging volume and how current goals are moving.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="This week" value={fmtNum(data.activities?.week ?? 0)} />
                  <MiniStat label="30 days" value={fmtNum(data.activities?.last30Days ?? 0)} />
                  <MiniStat label="Avg / day" value={fmtNum(data.activities?.averagePerActiveDay ?? 0)} />
                  <MiniStat label="Completion" value={fmtPct(data.progress?.completionRate ?? 0)} />
                </div>

                <div className="mt-5 space-y-3">
                  {activityMix.length ? activityMix.map((item) => (
                    <BarRow key={item.label} label={item.label} value={`${fmtNum(item.count)} entries`} width={item.width} tone="sky" />
                  )) : <EmptyLine text="No recent activity logs are available yet." />}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="In progress" value={fmtNum(data.progress?.inProgress ?? 0)} />
                  <MiniStat label="Completed" value={fmtNum(data.progress?.completed ?? 0)} tone="emerald" />
                  <MiniStat label="Passed" value={fmtNum(data.progress?.passed ?? 0)} tone="sky" />
                  <MiniStat label="Failed" value={fmtNum(data.progress?.failed ?? 0)} tone="rose" />
                </div>
              </Panel>

              <Panel title="Training, reviews, and attendance" description="Keep the development record and reliability signals together in one place.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="Training hours" value={fmtNum(data.training?.totalHours ?? 0)} tone="amber" />
                  <MiniStat label="Evaluations" value={fmtNum(data.evaluations?.count ?? 0)} tone="violet" />
                  <MiniStat label="Late" value={fmtNum(data.attendance?.late ?? 0)} tone="amber" />
                  <MiniStat label="Absent" value={fmtNum(data.attendance?.absent ?? 0)} tone="rose" />
                </div>

                <div className="mt-5 space-y-3">
                  {trainingMix.length ? trainingMix.map((item) => (
                    <BarRow key={item.label} label={item.label} value={`${fmtNum(item.hours)} hours`} width={item.width} tone="amber" />
                  )) : <EmptyLine text="No training records have been logged yet." />}
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Latest review</div>
                  {data.evaluations?.latest ? (
                    <div className="mt-3 space-y-2">
                      <DetailRow label="Period" value={data.evaluations.latest.period || "-"} />
                      <DetailRow label="Status" value={humanize(data.evaluations.latest.status)} />
                      <DetailRow label="Score" value={data.evaluations.latest.overallScore ?? "-"} />
                      <DetailRow label="Created" value={fmtDate(data.evaluations.latest.createdAt)} />
                      <DetailRow label="Acknowledged" value={data.evaluations.latest.teacherAcknowledgedAt ? fmtDate(data.evaluations.latest.teacherAcknowledgedAt) : "Pending"} />
                    </div>
                  ) : (
                    <EmptyLine text="No evaluations are available yet." />
                  )}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}

function HeroStat({ label, value, hint }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-300">{label}</div><div className="mt-1 text-lg font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-300">{hint}</div></div>;
}

function Notice({ tone = "amber", title, children }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
  };
  return <div className={`mt-6 rounded-[1.5rem] border p-5 ${tones[tone] || tones.amber}`}><div className="text-sm font-black">{title}</div><div className="mt-2 text-sm leading-6">{children}</div></div>;
}

function RetryButton({ onClick, label }) {
  return <button type="button" onClick={onClick} className="mt-4 inline-flex rounded-xl border border-current/20 bg-white px-4 py-2 text-sm font-bold transition hover:bg-white/70 dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-slate-800">{label}</button>;
}

function Panel({ title, description, children }) {
  return <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"><h2 className="text-base font-black text-slate-950 dark:text-slate-100">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p><div className="mt-4">{children}</div></section>;
}

function TopCard({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-100 bg-sky-50/90 dark:border-sky-900/60 dark:bg-sky-950/30",
    emerald: "border-emerald-100 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/25",
    amber: "border-amber-100 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/25",
    violet: "border-violet-100 bg-violet-50/90 dark:border-violet-900/60 dark:bg-violet-950/25",
  };
  return <div className={`rounded-[1.6rem] border p-4 ${tones[tone] || tones.sky}`}><div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div><div className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-100">{value}</div><div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hint}</div></div>;
}

function FocusCard({ item }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    sky: "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20",
    rose: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20",
  };
  return <div className={`rounded-[1.4rem] border p-4 ${tones[item.tone] || tones.sky}`}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950 dark:text-slate-100">{item.title}</div><div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.status}</div></div><div className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-950 dark:bg-slate-950 dark:text-slate-100">{item.value}</div></div><p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.detail}</p><Link href={item.href} className="mt-3 inline-flex text-sm font-bold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300">Open</Link></div>;
}

function QuickLink({ href, label }) {
  return <Link href={href} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100"><span>{label}</span><span className="text-slate-400 dark:text-slate-500">Open</span></Link>;
}

function MiniStat({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70",
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20",
    rose: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20",
    sky: "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20",
    violet: "border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/20",
  };
  return <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.gray}`}><div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">{value}</div></div>;
}

function BarRow({ label, value, width, tone = "sky" }) {
  const tones = { sky: "bg-sky-500", amber: "bg-amber-500" };
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span><span className="font-bold text-slate-950 dark:text-slate-100">{value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${tones[tone] || tones.sky}`} style={{ width: `${width}%` }} /></div></div>;
}

function DetailRow({ label, value }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"><span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span><span className="text-sm font-black text-slate-950 dark:text-slate-100">{value}</span></div>;
}

function EmptyLine({ text }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">{text}</div>;
}
