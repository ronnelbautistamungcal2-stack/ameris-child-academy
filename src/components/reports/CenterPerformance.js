import Pager from "@/components/ui/Pager";
import StaffPerformanceTable from "@/components/reports/StaffPerformanceTable";
import SegmentBar, { RANGE_COLORS, RANGE_TEXT } from "@/components/reports/SegmentBar";
import { Heading, NAVY, RangePicker, card, keyOf, useRange } from "@/components/reports/reportUi";
import { apiJson } from "@/lib/api";
import { CHARACTER_HIGHLIGHT_TYPE_OPTIONS, courseCorrectionTypeOptions } from "@/lib/dailyLogOptions";
import { SOP_STATUSES } from "@/lib/sop";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Center Performance Overview (client mockups 2026-10-02). The Teacher and
// Student Performance bars are built from the Staff and Student Performance
// Overview rows below them, so they always agree; clicking a colour lists the
// people in that range under the charts.

const CountsBarChart = dynamic(() => import("@/components/reports/CountsBarChart"), { ssr: false });
const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const STUDENT_PAGE = 10;

const GRADE_RANGES = [
  { key: "0", label: "0 - 59", min: 0, max: 59.999 },
  { key: "1", label: "60 - 69", min: 60, max: 69.999 },
  { key: "2", label: "70 - 79", min: 70, max: 79.999 },
  { key: "3", label: "80 - 89", min: 80, max: 89.999 },
  { key: "4", label: "90 - 100", min: 90, max: 100 },
];
const CITIZENSHIP_RANGES = [
  { key: "0", label: "(0-2)", min: 0, max: 2.499 },
  { key: "1", label: "(3-4)", min: 2.5, max: 4.499 },
  { key: "2", label: "(5-6)", min: 4.5, max: 6.499 },
  { key: "3", label: "(7-8)", min: 6.5, max: 8.499 },
  { key: "4", label: "(9-10)", min: 8.5, max: 10 },
];
const LEVEL_SEGMENTS = [
  { key: "EXPOSURE", label: "Exposure", color: "bg-orange-400", text: "text-orange-500" },
  { key: "COMPETENCY", label: "Competence", color: "bg-yellow-300", text: "text-yellow-600" },
  { key: "MASTERY", label: "Mastery", color: "bg-green-700", text: "text-green-800" },
];

function rangeIndex(ranges, value) {
  if (value == null) return -1;
  return ranges.findIndex((r) => value >= r.min && value <= r.max);
}

function rangeSegments(ranges, values) {
  const counts = ranges.map(() => 0);
  for (const v of values) {
    const i = rangeIndex(ranges, v);
    if (i >= 0) counts[i] += 1;
  }
  return ranges.map((r, i) => ({ key: r.key, label: r.label, count: counts[i], color: RANGE_COLORS[i], text: RANGE_TEXT[i] }));
}

function citizenshipTone(value) {
  const i = rangeIndex(CITIZENSHIP_RANGES, value);
  return ["bg-red-100 text-red-800", "bg-orange-100 text-orange-800", "bg-yellow-100 text-yellow-800", "bg-green-100 text-green-800", "bg-emerald-200 text-emerald-900"][i] || "bg-gray-100 text-gray-500";
}

const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
const num = (v) => (v == null ? "—" : v);

function ageYears(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

function ageLabel(birthDate) {
  const y = ageYears(birthDate);
  if (y == null) return "—";
  if (y < 1) {
    const b = new Date(birthDate);
    const now = new Date();
    return `${(now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth()} mo`;
  }
  return `${y} yr${y === 1 ? "" : "s"}`;
}

function Collapsible({ title, open, onToggle, children }) {
  return (
    <section className={card}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full items-center gap-2 text-left text-2xl font-black ${NAVY}`}>
        {title}
        <span aria-hidden className="text-base">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

export default function CenterPerformance() {
  const [centerId, setCenterId] = useState("");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { start: keyOf(from), end: keyOf(to) };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // { chart, key }
  const [staffOpen, setStaffOpen] = useState(true);
  const [studentsOpen, setStudentsOpen] = useState(true);
  const [studentFilter, setStudentFilter] = useState({ q: "", parent: "", age: "", teacher: "" });
  const [studentPage, setStudentPage] = useState(1);
  const corrections = useRange();
  const highlights = useRange();

  useEffect(() => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ from: range.start, to: range.end, ...(centerId ? { centerId } : {}) });
    apiJson(`/api/v1/reports/center-performance?${q}`)
      .then((d) => {
        setData(d);
        if (d.center && d.center.id !== centerId) setCenterId(d.center.id);
      })
      .catch((e) => setError(e.message || "Could not load the center report"))
      .finally(() => setLoading(false));
  }, [centerId, range]);

  const staff = useMemo(() => data?.staff || [], [data]);
  const students = useMemo(() => data?.students || [], [data]);

  const charts = useMemo(() => {
    const levelCounts = { EXPOSURE: 0, COMPETENCY: 0, MASTERY: 0 };
    for (const s of students) for (const k of Object.keys(levelCounts)) levelCounts[k] += s.levels?.[k] || 0;
    const statusCounts = Object.fromEntries(SOP_STATUSES.map((s) => [s.value, 0]));
    for (const s of students) if (s.milestones) statusCounts[s.milestones] += 1;
    return {
      grade: rangeSegments(GRADE_RANGES, staff.map((s) => s.currentGrade)),
      evaluation: rangeSegments(GRADE_RANGES, staff.map((s) => s.evaluationPct)),
      hr: rangeSegments(GRADE_RANGES, staff.map((s) => s.hrPct)),
      citizenship: rangeSegments(CITIZENSHIP_RANGES, students.map((s) => s.citizenship)),
      competency: LEVEL_SEGMENTS.map((l) => ({ ...l, count: levelCounts[l.key] })),
      progress: SOP_STATUSES.map((s, i) => ({ key: s.value, label: s.label, count: statusCounts[s.value], color: s.bar, text: RANGE_TEXT[i] })),
    };
  }, [staff, students]);

  // People in the selected colour, listed under the charts.
  const picked = useMemo(() => {
    if (!selected) return null;
    const { chart, key } = selected;
    const inGrade = (v) => GRADE_RANGES[Number(key)] && rangeIndex(GRADE_RANGES, v) === Number(key);
    const titles = { grade: "Overall Grade", evaluation: "Evaluations", hr: "HR", citizenship: "Citizenship", competency: "Milestone Competency", progress: "Milestone Progress" };
    let people = [];
    let label = "";
    if (chart === "grade" || chart === "evaluation" || chart === "hr") {
      const field = { grade: "currentGrade", evaluation: "evaluationPct", hr: "hrPct" }[chart];
      people = staff.filter((s) => inGrade(s[field])).map((s) => ({ id: s.id, name: s.name, detail: `${s.position} · ${pct(s[field])}` }));
      label = GRADE_RANGES[Number(key)].label;
    } else if (chart === "citizenship") {
      people = students.filter((s) => rangeIndex(CITIZENSHIP_RANGES, s.citizenship) === Number(key)).map((s) => ({ id: s.id, name: s.name, detail: `Citizenship ${s.citizenship}` }));
      label = CITIZENSHIP_RANGES[Number(key)].label;
    } else if (chart === "competency") {
      people = students.filter((s) => s.levels?.[key] > 0).map((s) => ({ id: s.id, name: s.name, detail: `${s.levels[key]} goal${s.levels[key] === 1 ? "" : "s"}` }));
      label = LEVEL_SEGMENTS.find((l) => l.key === key)?.label;
    } else {
      people = students.filter((s) => s.milestones === key).map((s) => ({ id: s.id, name: s.name, detail: s.classroom }));
      label = SOP_STATUSES.find((s) => s.value === key)?.label;
    }
    return { title: `${titles[chart]}: ${label}`, people, kind: ["grade", "evaluation", "hr"].includes(chart) ? "staff" : "students" };
  }, [selected, staff, students]);

  const teacherOptions = useMemo(() => {
    const map = new Map();
    for (const s of students) s.teacherIds.forEach((id, i) => map.set(id, s.teacher.split(", ")[i] || id));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [students]);
  const studentRows = useMemo(() => {
    const q = studentFilter.q.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) &&
        (!studentFilter.parent || s.parent === studentFilter.parent) &&
        (!studentFilter.age || String(ageYears(s.birthDate) ?? "") === studentFilter.age) &&
        (!studentFilter.teacher || s.teacherIds.includes(studentFilter.teacher)),
    );
  }, [students, studentFilter]);
  const studentPages = Math.max(1, Math.ceil(studentRows.length / STUDENT_PAGE));
  const studentCurrent = Math.min(studentPage, studentPages);
  const parents = useMemo(() => [...new Set(students.map((s) => s.parent).filter(Boolean))].sort(), [students]);
  const ages = useMemo(() => [...new Set(students.map((s) => ageYears(s.birthDate)).filter((a) => a != null))].sort((a, b) => a - b), [students]);

  const correctionBars = useMemo(() => {
    // Character Guide categories that were logged, plus any older types.
    const entries = (data?.courseCorrections || []).filter((e) => corrections.inRange(e.date));
    const options = courseCorrectionTypeOptions([], entries);
    const tally = Object.fromEntries(options.map((t) => [t.value, 0]));
    for (const e of entries) tally[e.type || "OTHER"] += 1;
    return options.map((t) => ({ label: t.label, count: tally[t.value] }));
  }, [data, corrections]);
  const highlightBars = useMemo(() => {
    const tally = Object.fromEntries(CHARACTER_HIGHLIGHT_TYPE_OPTIONS.map((t) => [t.value, 0]));
    for (const e of data?.characterHighlights || []) if (highlights.inRange(e.date)) tally[e.type in tally ? e.type : "OTHER"] += 1;
    return CHARACTER_HIGHLIGHT_TYPE_OPTIONS.map((t) => ({ label: t.label, count: tally[t.value] }));
  }, [data, highlights]);

  const select = (chart) => (key) => setSelected((cur) => (cur?.chart === chart && cur?.key === key ? null : { chart, key }));
  const isSel = (chart) => (selected?.chart === chart ? selected.key : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-4xl font-black ${NAVY}`}>Center Performance Overview</h1>
        <div className="flex flex-wrap items-end gap-3">
          {data?.centers?.length > 1 && (
            <label className={`text-xs font-semibold ${NAVY}`}>
              Center
              <select value={centerId} onChange={(e) => { setSelected(null); setCenterId(e.target.value); }} className={`${control} mt-1 block w-48`}>
                {data.centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label className={`text-xs font-semibold ${NAVY}`}>
            From
            <input type="date" value={range.start} max={range.end} onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })} className={`${control} mt-1 block`} />
          </label>
          <label className={`text-xs font-semibold ${NAVY}`}>
            To
            <input type="date" value={range.end} min={range.start} onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value })} className={`${control} mt-1 block`} />
          </label>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Working out the center&apos;s figures...</p>}

      {data && (
        <>
          <div className={`grid grid-cols-1 gap-4 xl:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
            <section className={`${card} space-y-5`}>
              <h2 className={`text-3xl font-black ${NAVY}`}>Teacher Performance</h2>
              <SegmentBar title="Overall Grade (%)" segments={charts.grade} selected={isSel("grade")} onSelect={select("grade")} />
              <SegmentBar title="Evaluations (%)" segments={charts.evaluation} selected={isSel("evaluation")} onSelect={select("evaluation")} />
              <SegmentBar title="HR (%)" segments={charts.hr} selected={isSel("hr")} onSelect={select("hr")} />
              <div className="flex flex-wrap justify-around gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                {GRADE_RANGES.map((r, i) => (
                  <span key={r.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className={`h-5 w-6 rounded ${RANGE_COLORS[i]}`} aria-hidden /> {r.label}
                  </span>
                ))}
              </div>
            </section>
            <section className={`${card} space-y-5`}>
              <h2 className={`text-3xl font-black ${NAVY}`}>Student Performance</h2>
              <SegmentBar title="Citizenship (0 - 10)" segments={charts.citizenship} selected={isSel("citizenship")} onSelect={select("citizenship")} />
              <SegmentBar title="Milestone Competency" segments={charts.competency} selected={isSel("competency")} onSelect={select("competency")} />
              <SegmentBar title="Milestone Progress" segments={charts.progress} selected={isSel("progress")} onSelect={select("progress")} />
            </section>
          </div>

          {picked && (
            <section className={card} aria-live="polite">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-black ${NAVY}`}>
                  {picked.title} <span className="text-sm font-semibold text-gray-500">({picked.people.length} {picked.kind === "staff" ? "staff" : "students"})</span>
                </h3>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close list" className="text-xl text-gray-500">&times;</button>
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {picked.people.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-gray-100 py-1.5 text-sm dark:border-gray-800">
                    {picked.kind === "staff" ? (
                      <Link href={`/admin/reports/teachers?teacherId=${p.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{p.name}</Link>
                    ) : (
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</span>
                    )}
                    <span className="text-gray-500">{p.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Collapsible title="Staff Performance Overview" open={staffOpen} onToggle={() => setStaffOpen((o) => !o)}>
            <StaffPerformanceTable staff={staff} viewHref={(row) => `/admin/reports/teachers?teacherId=${row.id}`} />
          </Collapsible>

          <Collapsible title="Student Performance Overview" open={studentsOpen} onToggle={() => setStudentsOpen((o) => !o)}>
            <div className="flex flex-wrap items-end gap-3">
              <input value={studentFilter.q} onChange={(e) => { setStudentFilter({ ...studentFilter, q: e.target.value }); setStudentPage(1); }} placeholder="Search students..." aria-label="Search students" className={`${control} w-56`} />
              {[
                ["parent", "Parent", "All Parents", parents.map((p) => [p, p])],
                ["age", "Age Group", "All Ages", ages.map((a) => [String(a), a < 1 ? "Under 1 year" : `${a} year${a === 1 ? "" : "s"}`])],
                ["teacher", "Teacher", "All Teachers", teacherOptions],
              ].map(([key, label, all, opts]) => (
                <label key={key} className={`text-sm font-semibold ${NAVY}`}>
                  {label}
                  <select value={studentFilter[key]} onChange={(e) => { setStudentFilter({ ...studentFilter, [key]: e.target.value }); setStudentPage(1); }} className={`${control} mt-1 block w-48`}>
                    <option value="">{all}</option>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              ))}
              <button type="button" onClick={() => setStudentFilter({ q: "", parent: "", age: "", teacher: "" })} className="ml-auto rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Clear Filters</button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className={`bg-blue-50 text-left text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                    {["Student Name", "Parent Name", "Age", "Teacher", "Citizenship (0 - 10)", "Milestones", "IPP Status"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {studentRows.slice((studentCurrent - 1) * STUDENT_PAGE, studentCurrent * STUDENT_PAGE).map((s) => {
                    const status = SOP_STATUSES.find((x) => x.value === s.milestones);
                    return (
                      <tr key={s.id} className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-300">
                        <td className="px-2 py-1.5 font-semibold text-blue-700 dark:text-blue-300">{s.name}</td>
                        <td className="px-2 py-1.5">{s.parent || "—"}</td>
                        <td className="px-2 py-1.5">{ageLabel(s.birthDate)}</td>
                        <td className="px-2 py-1.5">{s.teacher || "—"}</td>
                        <td className="px-2 py-1.5"><span className={`inline-block min-w-[40px] rounded px-2 py-0.5 text-center font-bold ${citizenshipTone(s.citizenship)}`}>{num(s.citizenship)}</span></td>
                        <td className="px-2 py-1.5">{status ? <span className={`inline-block rounded px-3 py-0.5 text-xs font-bold ${status.pill}`}>{status.label}</span> : "—"}</td>
                        <td className="px-2 py-1.5">
                          {s.ipp === "ON_TRACK" ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">On Track</span> : s.ipp === "NEEDS_REVIEW" ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Needs Review</span> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!studentRows.length && <tr><td colSpan={7} className="py-4 text-center text-gray-500">No students match.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={`mt-2 flex items-center justify-between text-sm ${NAVY}`}>
              <span>
                Showing {studentRows.length ? (studentCurrent - 1) * STUDENT_PAGE + 1 : 0} to {Math.min(studentCurrent * STUDENT_PAGE, studentRows.length)} of {studentRows.length} students
              </span>
              <Pager page={studentCurrent} pages={studentPages} onPage={setStudentPage} />
            </div>
          </Collapsible>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className={card}>
              <Heading icon={"\u{1F6A8}"}>Course Correction</Heading>
              <p className="-mt-2 mb-2 text-sm text-gray-500">Number of course corrections logged by category.</p>
              <RangePicker {...corrections} label="Course Correction" />
              <CountsBarChart data={correctionBars} color="#f87171" />
            </section>
            <section className={card}>
              <Heading icon={"\u{1F3C5}"}>Character Highlights</Heading>
              <p className="-mt-2 mb-2 text-sm text-gray-500">Number of character highlights logged by category.</p>
              <RangePicker {...highlights} label="Character Highlight" />
              <CountsBarChart data={highlightBars} color="#2f855a" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
