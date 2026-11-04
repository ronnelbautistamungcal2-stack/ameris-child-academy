import ActivityLogEntry, { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from "@/components/reports/ActivityLogEntry";
import DrillDownList from "@/components/reports/DrillDownList";
import { Heading, NAVY, RangePicker, card, useRange } from "@/components/reports/reportUi";
import StatusMixBar from "@/components/sop/StatusMixBar";
import { apiJson } from "@/lib/api";
import { classCitizenshipPercent } from "@/lib/citizenship";
import { SOP_STATUSES } from "@/lib/sop";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

// Class Performance Report (client mockups 2026-10-02): Citizenship Grade (class average), Milestones Grade, Course Correction and
// Character Highlight charts, Students on an Individual Plan, Students on Red
// Flag and the class's Student Activity Log.

const CitizenshipChart = dynamic(() => import("@/components/reports/CitizenshipChart"), { ssr: false });
const CountsBarChart = dynamic(() => import("@/components/reports/CountsBarChart"), { ssr: false });

function counts(entries, types, inRange) {
  const tally = Object.fromEntries(types.map((t) => [t.value, 0]));
  for (const e of entries) {
    if (!inRange(e.date)) continue;
    const key = e.type in tally ? e.type : "OTHER";
    tally[key] = (tally[key] || 0) + 1;
  }
  return types.map((t) => ({ key: t.value, label: t.label, count: tally[t.value] || 0 }));
}

// Activity log types in the grid, in the mockup's order (r176).
const GRID_TYPES = ["DIAPER_CHANGE", "NAP", "BOTTLE", "MEAL", "SNACK", "ACTIVITY", "BEHAVIOR", "CHARACTER_HIGHLIGHT", "INCIDENT", "TOILETING", "ACCOMPLISHMENT", "OTHER"];

function relative(value) {
  if (!value) return "No logs";
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NameTable({ rows, second, empty }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`bg-blue-50 text-left font-bold dark:bg-gray-800 ${NAVY}`}>
          <th className="px-3 py-1.5">Student Name</th>
          <th className="px-3 py-1.5">{second}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.childId}-${i}`} className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-300">
            <td className="px-3 py-1.5">{r.name}</td>
            <td className="px-3 py-1.5">{r.value}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={2} className="px-3 py-3 text-center text-gray-500">{empty}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** sections={["grades"]}: only the Citizenship Grade and Milestones Grade cards (teacher My Performance). */
export default function ClassPerformance({ classRoomId, header = null, sections = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [logDate, setLogDate] = useState("");
  const [activity, setActivity] = useState(null);
  const citizenship = useRange();
  const corrections = useRange();
  const highlights = useRange();
  // Clicking a bar or a milestone colour lists the students behind it (client request 2026-10-29).
  const [pickedCorrection, setPickedCorrection] = useState("");
  const [pickedHighlight, setPickedHighlight] = useState("");
  const [pickedMilestone, setPickedMilestone] = useState(null); // { name, status }
  const [gridChild, setGridChild] = useState("");

  useEffect(() => {
    if (!classRoomId) return;
    setData(null);
    setError("");
    setLogDate("");
    apiJson(`/api/v1/reports/class/${encodeURIComponent(classRoomId)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Could not load the report"));
  }, [classRoomId]);

  useEffect(() => {
    if (!classRoomId || !logDate) {
      setActivity(null);
      return;
    }
    apiJson(`/api/v1/reports/class/${encodeURIComponent(classRoomId)}?logDate=${logDate}`)
      .then((d) => setActivity(d.activity))
      .catch(() => setActivity([]));
  }, [classRoomId, logDate]);

  const points = useMemo(() => (data?.citizenship || []).filter((p) => citizenship.inRange(p.date)), [data, citizenship]);
  // Average Citizenship Grade % for the chart's dates: each student's
  // average grade weighted (5 = 100%), averaged over the students.
  const citizenshipPct = useMemo(() => classCitizenshipPercent((data?.citizenshipGrades || []).filter((g) => citizenship.inRange(g.date))), [data, citizenship]);
  const correctionBars = useMemo(() => (data ? counts(data.courseCorrections, data.courseCorrectionTypes, corrections.inRange) : []), [data, corrections]);
  const highlightBars = useMemo(() => (data ? counts(data.characterHighlights, data.characterHighlightTypes, highlights.inRange) : []), [data, highlights]);
  // Allergies always count; a level 3+ course correction counts inside the
  // Course Correction chart's dates.
  const redFlags = useMemo(() => (data?.redFlags || []).filter((f) => !f.date || corrections.inRange(f.date)), [data, corrections]);

  if (error) return <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return <p className="text-sm text-gray-500">Loading the report...</p>;
  const activityList = activity ?? data.activity;

  return (
    sections && !sections.includes("all") ? (
      <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={card}>
          <div className="flex items-center gap-3">
            <Heading icon={"⭐"}>Citizenship Grade</Heading>
            {citizenshipPct != null ? (
              <span className={`mb-3 text-2xl font-black ${NAVY}`} title="Average citizenship grade % for these dates" data-testid="class-citizenship-percent">
                {citizenshipPct}%
              </span>
            ) : null}
          </div>
          <RangePicker {...citizenship} label="Citizenship Grade" />
          {points.length ? <CitizenshipChart points={points} /> : <p className="py-6 text-center text-sm text-gray-500">No citizenship grades in these dates.</p>}
        </section>
        <section className={card}>
          <div className="flex items-center gap-3">
            <Heading icon={"\u{1F3C6}"}>Milestones Grade</Heading>
            {data.milestonePct != null ? <span className={`mb-3 text-2xl font-black ${NAVY}`}>{data.milestonePct}%</span> : null}
          </div>
          {!data.milestones.length && <p className="text-sm text-gray-500">No milestones assessed in this class yet.</p>}
          <div className="space-y-3">
            {data.milestones.map((m) => (
              <div key={m.name} className="flex flex-wrap items-center gap-3">
                <span className={`w-36 text-sm font-black ${NAVY}`}>{m.name}</span>
                <StatusMixBar distribution={m.distribution} className="min-w-[220px] flex-1" onSegment={(status) => setPickedMilestone((cur) => (cur?.name === m.name && cur?.status === status ? null : { name: m.name, status }))} />
              </div>
            ))}
          </div>
          {pickedMilestone ? (
            <DrillDownList
              title={`${pickedMilestone.name}: ${SOP_STATUSES.find((s) => s.value === pickedMilestone.status)?.label || ""}`}
              entries={(data.milestones.find((m) => m.name === pickedMilestone.name)?.students?.[pickedMilestone.status] || []).map((s) => ({ childId: s.childId, name: s.name, detail: s.goals.join(", ") }))}
              onClose={() => setPickedMilestone(null)}
            />
          ) : null}
        </section>
      </div>
      </div>
    ) : (
    <div className="space-y-4">
      {header ? header(data.classroom) : null}
      <section className={card}>
        <h2 className={`flex items-center gap-2 text-2xl font-black ${NAVY}`}>
          <span aria-hidden>{"\u{1F4CA}"}</span> Class Performance Report
        </h2>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={card}>
          <div className="flex items-center gap-3">
            <Heading icon={"⭐"}>Citizenship Grade</Heading>
            {citizenshipPct != null ? (
              <span className={`mb-3 text-2xl font-black ${NAVY}`} title="Average citizenship grade % for these dates" data-testid="class-citizenship-percent">
                {citizenshipPct}%
              </span>
            ) : null}
          </div>
          <RangePicker {...citizenship} label="Citizenship Grade" />
          {points.length ? <CitizenshipChart points={points} /> : <p className="py-6 text-center text-sm text-gray-500">No citizenship grades in these dates.</p>}
        </section>
        <section className={card}>
          <div className="flex items-center gap-3">
            <Heading icon={"\u{1F3C6}"}>Milestones Grade</Heading>
            {data.milestonePct != null ? <span className={`mb-3 text-2xl font-black ${NAVY}`}>{data.milestonePct}%</span> : null}
          </div>
          {!data.milestones.length && <p className="text-sm text-gray-500">No milestones assessed in this class yet.</p>}
          <div className="space-y-3">
            {data.milestones.map((m) => (
              <div key={m.name} className="flex flex-wrap items-center gap-3">
                <span className={`w-36 text-sm font-black ${NAVY}`}>{m.name}</span>
                <StatusMixBar distribution={m.distribution} className="min-w-[220px] flex-1" onSegment={(status) => setPickedMilestone((cur) => (cur?.name === m.name && cur?.status === status ? null : { name: m.name, status }))} />
              </div>
            ))}
          </div>
          {pickedMilestone ? (
            <DrillDownList
              title={`${pickedMilestone.name}: ${SOP_STATUSES.find((s) => s.value === pickedMilestone.status)?.label || ""}`}
              entries={(data.milestones.find((m) => m.name === pickedMilestone.name)?.students?.[pickedMilestone.status] || []).map((s) => ({ childId: s.childId, name: s.name, detail: s.goals.join(", ") }))}
              onClose={() => setPickedMilestone(null)}
            />
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={card}>
          <Heading icon={"\u{1F3AF}"}>Course Correction Chart</Heading>
          <RangePicker {...corrections} label="Course Correction" />
          <CountsBarChart data={correctionBars} color="#f87171" selected={pickedCorrection} onSelect={(bar) => setPickedCorrection((cur) => (cur === bar.key ? "" : bar.key))} />
          {pickedCorrection ? (
            <DrillDownList
              title={correctionBars.find((b) => b.key === pickedCorrection)?.label || "Course Correction"}
              entries={data.courseCorrections.filter((e) => (e.type in Object.fromEntries(data.courseCorrectionTypes.map((t) => [t.value, 1])) ? e.type : "OTHER") === pickedCorrection && corrections.inRange(e.date))}
              onClose={() => setPickedCorrection("")}
            />
          ) : null}
        </section>
        <section className={card}>
          <Heading icon={"\u{1F3C5}"}>Character Highlight Chart</Heading>
          <RangePicker {...highlights} label="Character Highlight" />
          <CountsBarChart data={highlightBars} color="#2f855a" selected={pickedHighlight} onSelect={(bar) => setPickedHighlight((cur) => (cur === bar.key ? "" : bar.key))} />
          {pickedHighlight ? (
            <DrillDownList
              title={highlightBars.find((b) => b.key === pickedHighlight)?.label || "Character Highlight"}
              entries={data.characterHighlights.filter((e) => (e.type in Object.fromEntries(data.characterHighlightTypes.map((t) => [t.value, 1])) ? e.type : "OTHER") === pickedHighlight && highlights.inRange(e.date))}
              onClose={() => setPickedHighlight("")}
            />
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={card}>
          <Heading icon={"\u{1F4C4}"}>Students on Individual Plan</Heading>
          <NameTable rows={data.ipps.map((p) => ({ childId: p.childId, name: p.name, value: p.focusArea }))} second="Focus Area" empty="No students on an open plan." />
        </section>
        <section className={card}>
          <Heading icon={"⚠️"}>Students on Red Flag</Heading>
          <NameTable
            rows={redFlags.map((f) => ({ childId: f.childId, name: f.name, value: f.level ? `${f.flag} (Level ${f.level})` : f.flag }))}
            second="Red Flag"
            empty="No students on red flag."
          />
        </section>
      </div>

      <section className={card}>
        <Heading icon={"\u{1F4CB}"}>Student Activity Log</Heading>
        <label className={`flex items-center gap-3 text-sm font-semibold ${NAVY}`}>
          Jump to Date
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800" />
          {logDate && (
            <button type="button" onClick={() => setLogDate("")} className="rounded-lg border border-gray-300 px-3 py-1 text-xs dark:border-gray-600">
              Show latest
            </button>
          )}
        </label>
        {/* A row per child with their log counts by type (client mockup r176); click a child for their latest entries. */}
        {!logDate && data.activityCounts?.length ? (
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className={`bg-blue-50 text-left text-xs font-bold uppercase dark:bg-gray-800 ${NAVY}`}>
                  <th className="px-3 py-2">Child</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Last Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.activityCounts.map((row) => (
                  <tr key={row.childId} className={`cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-800 ${gridChild === row.childId ? "bg-blue-50/60 dark:bg-gray-800" : ""}`} onClick={() => setGridChild(gridChild === row.childId ? "" : row.childId)}>
                    <td className="px-3 py-2 font-semibold text-blue-800 dark:text-blue-200">{row.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {GRID_TYPES.map((type) => {
                          const count = row.counts[type] || 0;
                          return (
                            <span key={type} title={`${ACTIVITY_TYPE_LABELS[type] || type}: ${count}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${count ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100" : "text-gray-400"}`}>
                              <span aria-hidden>{ACTIVITY_ICONS[type] || "📄"}</span>
                              {count}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="font-semibold text-gray-800 dark:text-gray-100">{relative(row.lastAt)}</div>
                      <div className="text-xs text-gray-500">{row.total} logs recorded</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {logDate || gridChild || !data.activityCounts?.length ? (
          <div className="mt-3 space-y-2">
            {(gridChild ? activityList.filter((a) => a.childId === gridChild) : activityList).map((a) => (
              <ActivityLogEntry key={a.id} activity={a} />
            ))}
            {!activityList.length && <p className="text-sm text-gray-500">{logDate ? "No activity logs for that date." : "No activity logs yet."}</p>}
            {gridChild && !activityList.some((a) => a.childId === gridChild) ? <p className="text-sm text-gray-500">No recent entries for this child; use Jump to Date for older days.</p> : null}
          </div>
        ) : null}
      </section>
    </div>
    )
  );
}
