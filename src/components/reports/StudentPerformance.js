import IppPopup from "@/components/ipp/IppPopup";
import ActivityLogEntry from "@/components/reports/ActivityLogEntry";
import StatusMixBar from "@/components/sop/StatusMixBar";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { RangePicker, Heading, NAVY, card, shortDate, useRange } from "@/components/reports/reportUi";
import { useEffect, useMemo, useState } from "react";

// Student Performance Report (client mockups 2026-10-02): Citizenship Grade,
// Active Goals, Milestones, Character Highlights, Course Corrections, open
// Individual Progress Plans and the Student Activity Log. Parents, teachers,
// coaches and Student Support all see this same report.

const CitizenshipChart = dynamic(() => import("@/components/reports/CitizenshipChart"), { ssr: false });

function DatedList({ items, empty }) {
  if (!items.length) return <p className="py-3 text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
      {items.map((item) => (
        <li key={item.id} className={`flex items-center justify-between gap-3 py-2 text-[15px] ${NAVY}`} title={item.notes || undefined}>
          <span>
            {item.label}
            {item.level ? <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Level {item.level}</span> : null}
          </span>
          <span className="shrink-0">{shortDate(item.date)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StudentPerformance({ childId, header = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});
  const [ippId, setIppId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [activity, setActivity] = useState(null);
  const citizenship = useRange();
  const highlights = useRange();
  const corrections = useRange();

  useEffect(() => {
    if (!childId) return;
    setData(null);
    setError("");
    setLogDate("");
    setActivity(null);
    apiJson(`/api/v1/reports/student/${encodeURIComponent(childId)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Could not load the report"));
  }, [childId]);

  useEffect(() => {
    if (!childId || !logDate) {
      setActivity(null);
      return;
    }
    apiJson(`/api/v1/reports/student/${encodeURIComponent(childId)}?logDate=${logDate}`)
      .then((d) => setActivity(d.activity))
      .catch(() => setActivity([]));
  }, [childId, logDate]);

  const points = useMemo(() => (data?.citizenship || []).filter((p) => citizenship.inRange(p.date)), [data, citizenship]);
  const highlightItems = useMemo(() => (data?.characterHighlights || []).filter((h) => highlights.inRange(h.date)), [data, highlights]);
  const correctionItems = useMemo(() => (data?.courseCorrections || []).filter((c) => corrections.inRange(c.date)), [data, corrections]);

  if (error) return <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return <p className="text-sm text-gray-500">Loading the report...</p>;

  const activityList = activity ?? data.activity;

  return (
    <div className="space-y-4">
      {header ? header(data.child) : null}

      <div className={`${card} !p-3`}>
        <h2 className={`flex items-center gap-2 text-lg font-black ${NAVY}`}>
          <span aria-hidden>{"\u{1F4CA}"}</span> Student Performance Report
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={card}>
          <Heading icon={"⭐"}>Citizenship Grade</Heading>
          <RangePicker {...citizenship} label="Citizenship Grade" />
          {points.length ? <CitizenshipChart points={points} /> : <p className="py-6 text-center text-sm text-gray-500">No citizenship grades in these dates.</p>}
        </section>
        <section className={card}>
          <Heading icon={"\u{1F3AF}"}>Active Goals</Heading>
          {data.activeGoals.length ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.activeGoals.map((g) => (
                <li key={g.id} className="py-2 text-[17px] text-blue-800 dark:text-blue-200">{g.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No active goals yet.</p>
          )}
        </section>
      </div>

      <section className={card}>
        <Heading icon={"\u{1F3C6}"}>Milestones</Heading>
        {!data.milestones.length && <p className="text-sm text-gray-500">No milestones assessed yet.</p>}
        <div className="space-y-2">
          {data.milestones.map((m) => {
            const isOpen = open[m.name];
            return (
              <div key={m.name} className="rounded-xl border border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setOpen({ ...open, [m.name]: !isOpen })} aria-expanded={Boolean(isOpen)} className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left">
                  <span className={`min-w-[180px] flex-1 text-lg font-black ${NAVY}`}>
                    <span aria-hidden className="mr-2">{isOpen ? "▾" : "›"}</span>
                    {m.name}
                  </span>
                  <StatusMixBar distribution={m.distribution} className="md:max-w-[60%]" />
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
                    {m.subjects.map((s) => (
                      <div key={s.name} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
                        <span className={`min-w-[180px] flex-1 text-sm font-semibold ${NAVY}`}>{s.name}</span>
                        <StatusMixBar distribution={s.distribution} className="md:max-w-[55%]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={card}>
          <Heading icon={"\u{1F3C5}"}>Character Highlight</Heading>
          <RangePicker {...highlights} label="Character Highlight" />
          <DatedList items={highlightItems} empty="No character highlights in these dates." />
        </section>
        <div className="space-y-4">
          <section className={card}>
            <Heading icon={"\u{1F6A8}"}>Course Correction</Heading>
            <RangePicker {...corrections} label="Course Correction" />
            <DatedList items={correctionItems} empty="No course corrections in these dates." />
          </section>
          <section className={card}>
            <Heading icon={"\u{1F4CB}"}>Individual Progress Plan</Heading>
            {data.ipps.length ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.ipps.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setIppId(p.id)} className={`flex w-full items-center justify-between py-2 text-left text-lg hover:underline ${NAVY}`}>
                      <span>{p.title}</span>
                      <span>{shortDate(p.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No open progress plans.</p>
            )}
          </section>
        </div>
      </div>

      <section className={card}>
        <h3 className="text-base font-black text-gray-900 dark:text-gray-100">Student Activity Log</h3>
        <p className="text-sm text-gray-500">Daily activity log.</p>
        <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Jump to Date
          <span className="mt-1 flex gap-2">
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal dark:border-gray-600 dark:bg-gray-800" />
            {logDate && (
              <button type="button" onClick={() => setLogDate("")} className="rounded-lg border border-gray-300 px-3 text-xs font-semibold normal-case tracking-normal dark:border-gray-600">
                Show latest
              </button>
            )}
          </span>
        </label>
        <div className="mt-3 space-y-2">
          {activityList.map((a) => (
            <ActivityLogEntry key={a.id} activity={a} />
          ))}
          {!activityList.length && <p className="text-sm text-gray-500">{logDate ? "No activity logs for that date." : "No activity logs yet."}</p>}
        </div>
      </section>

      {ippId && <IppPopup planId={ippId} onClose={() => setIppId("")} />}
    </div>
  );
}
