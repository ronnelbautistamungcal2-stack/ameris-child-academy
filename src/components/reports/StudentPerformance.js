import IppPopup from "@/components/ipp/IppPopup";
import ActivityLogEntry from "@/components/reports/ActivityLogEntry";
import ChildPhotos from "@/components/reports/ChildPhotos";
import MilestonesTracker from "@/components/sop/MilestonesTracker";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { RangePicker, Heading, NAVY, card, shortDate, useRange } from "@/components/reports/reportUi";
import { useEffect, useMemo, useState } from "react";

// Student Performance Report (client mockups 2026-10-02): Citizenship Grade,
// Active Goals, Milestones, Character Highlights, Course Corrections, open
// Individual Progress Plans and the Student Activity Log. Parents, teachers,
// coaches and Student Support all see this same report.

const CitizenshipChart = dynamic(() => import("@/components/reports/CitizenshipChart"), { ssr: false });

// Click an entry to read what the teacher logged (client request 2026-10-29).
function DatedList({ items, empty }) {
  const [openId, setOpenId] = useState("");
  if (!items.length) return <p className="py-3 text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? "" : item.id)}
              aria-expanded={open}
              className={`flex w-full items-center justify-between gap-3 py-2 text-left text-[15px] hover:bg-blue-50/50 dark:hover:bg-gray-800 ${NAVY}`}
            >
              <span>
                {item.label}
                {item.level ? <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Level {item.level}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {shortDate(item.date)}
                <span aria-hidden className={`text-xs text-gray-400 transition ${open ? "rotate-90" : ""}`}>›</span>
              </span>
            </button>
            {open ? (
              <div className="mb-2 rounded-lg bg-blue-50/60 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {item.notes || item.description || "No description was logged."}
                {item.loggedBy ? <div className="mt-1 text-xs text-gray-500">Logged by {item.loggedBy}</div> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Activity log entries with a heading for each day (client request 2026-10-29). */
function groupByDay(list) {
  const groups = [];
  for (const a of list) {
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups.length || groups[groups.length - 1].key !== key) {
      groups.push({ key, label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), items: [] });
    }
    groups[groups.length - 1].items.push(a);
  }
  return groups;
}

/**
 * familyView (parents): the activity log is a drop-down section with each
 * entry's note shown, and a Photos section follows it.
 */
export default function StudentPerformance({ childId, header = null, familyView = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ippId, setIppId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [activity, setActivity] = useState(null);
  const [logOpen, setLogOpen] = useState(!familyView);
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

  // After milestones are saved: refresh the report without blanking it.
  async function reload() {
    try {
      setData(await apiJson(`/api/v1/reports/student/${encodeURIComponent(childId)}`));
    } catch {}
  }

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
  // Average Citizenship Grade for the chart's dates: the grades / how many were recorded.
  const citizenshipAvg = points.length ? Math.round((points.reduce((sum, p) => sum + p.score, 0) / points.length) * 10) / 10 : null;
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
          <div className="flex items-center gap-3">
            <Heading icon={"⭐"}>Citizenship Grade</Heading>
            {citizenshipAvg != null ? (
              <span className={`mb-3 text-2xl font-black ${NAVY}`} title="Average citizenship grade for these dates" data-testid="citizenship-average">
                {citizenshipAvg}
              </span>
            ) : null}
          </div>
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
        <MilestonesTracker
          childId={childId}
          milestones={data.milestones}
          percent={data.milestonePct}
          canTrack={data.canTrack}
          onSaved={reload}
          heading={<Heading icon={"\u{1F3C6}"}>Milestones</Heading>}
        />
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
        {familyView ? (
          <button type="button" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} className="flex w-full items-center justify-between text-left">
            <span className="text-base font-black text-gray-900 dark:text-gray-100">Student Activity Log</span>
            <span aria-hidden className={`text-lg text-blue-700 transition ${logOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
        ) : (
          <>
            <h3 className="text-base font-black text-gray-900 dark:text-gray-100">Student Activity Log</h3>
            <p className="text-sm text-gray-500">Daily activity log.</p>
          </>
        )}
        {logOpen ? (
        <>
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
        <div className="mt-3 space-y-3">
          {groupByDay(activityList).map((group) => (
            <div key={group.key}>
              <div className="mb-1.5 border-b border-gray-200 pb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">{group.label}</div>
              <div className="space-y-2">
                {group.items.map((a) => (
                  <ActivityLogEntry key={a.id} activity={a} inline={familyView} />
                ))}
              </div>
            </div>
          ))}
          {!activityList.length && <p className="text-sm text-gray-500">{logDate ? "No activity logs for that date." : "No activity logs yet."}</p>}
        </div>
        </>
        ) : null}
      </section>

      {familyView ? <ChildPhotos childId={childId} childName={[data.child?.firstName, data.child?.lastName].filter(Boolean).join(" ")} /> : null}

      {ippId && <IppPopup planId={ippId} onClose={() => setIppId("")} />}
    </div>
  );
}
