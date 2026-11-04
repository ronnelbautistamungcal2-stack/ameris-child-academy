import { CenterSelect, NAVY, ReportControls, ReportMessage, ReportSheet, input, longDate, monthRange, shortDate, useReportCenters } from "@/components/reports/ReportSheet";
import { isCurrentlyEnrolled, useReportFilters } from "@/components/reports/ReportFilters";
import { apiJson } from "@/lib/api";
import { exportToExcel } from "@/lib/exportTable";
import { MEALS } from "@/lib/menuPlan";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

// Infant Feeding Report, Meal Production Record and Meal Claim (client
// request 2026-10-23), generated from Admin > Reports.

const HEAD = "bg-[#16305e] text-white";
const BAND = "bg-[#2f6fb3] text-white";
const ZEBRA = "odd:bg-white even:bg-blue-50/60 dark:odd:bg-gray-900 dark:even:bg-gray-800";

function DateRange({ range, setRange }) {
  return (
    <>
      <label className="block text-sm font-bold">
        From
        <input type="date" value={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={input} />
      </label>
      <label className="block text-sm font-bold">
        To
        <input type="date" value={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={input} />
      </label>
    </>
  );
}

const dayHeading = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "2-digit", year: "numeric" });

export function InfantFeedingReport() {
  const filters = useReportFilters();
  const { centers, centerId, setCenterId } = useReportCenters();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [range, setRange] = useState(() => monthRange());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Infants only (under 12 months on the report's start date), searchable by
  // name (client request 2026-10-29).
  const infantChoices = useMemo(() => {
    const start = new Date(`${range.from}T00:00:00`);
    const q = childSearch.trim().toLowerCase();
    return children.filter((c) => {
      if (c.id === childId) return true;
      if (filters.children !== "ALL" && !isCurrentlyEnrolled(c)) return false;
      if (c.birthDate) {
        const b = new Date(c.birthDate);
        const months = (start.getFullYear() - b.getFullYear()) * 12 + start.getMonth() - b.getMonth();
        if (months >= 12) return false;
      }
      return !q || c.name.toLowerCase().includes(q);
    });
  }, [children, childId, childSearch, filters.children, range.from]);

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/reports/infant-feeding?centerId=${encodeURIComponent(centerId)}`)
      .then((res) => setChildren(res.children || []))
      .catch((e) => setError(e.message || "Failed to load children"));
  }, [centerId]);

  useEffect(() => {
    if (!centerId || !childId) return setData(null);
    setError("");
    const qs = new URLSearchParams({ centerId, childId, ...range });
    apiJson(`/api/v1/reports/infant-feeding?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, childId, range]);

  const cols = data?.componentColumns || 2;
  return (
    <div className="space-y-4">
      <ReportControls title="Infant Feeding Report">
        <CenterSelect centers={centers} centerId={centerId} setCenterId={(id) => { setCenterId(id); setChildId(""); }} />
        <label className="block text-sm font-bold">
          Search Infant
          <input value={childSearch} onChange={(e) => setChildSearch(e.target.value)} placeholder="Type a name..." className={input} />
        </label>
        <label className="block text-sm font-bold">
          Infant
          <select value={childId} onChange={(e) => setChildId(e.target.value)} className={input}>
            <option value="">{infantChoices.length ? "Select an infant..." : "No infants match"}</option>
            {infantChoices.map((c) => <option key={c.id} value={c.id}>{c.name}{c.enrolled ? "" : " (not enrolled)"}</option>)}
          </select>
        </label>
        <DateRange range={range} setRange={setRange} />
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!childId ? (
        <ReportMessage>Choose a center and a child to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <ReportSheet title="Individual Infant Feeding Report" subtitle={`${longDate(data.from)} – ${longDate(data.to)}`}>
          <div className="grid gap-x-8 gap-y-1 px-6 pb-3 text-sm sm:grid-cols-3">
            <div><span className="inline-block w-24 text-gray-600">Child</span><b>{data.child.name}</b></div>
            <div><span className="inline-block w-24 text-gray-600">Date of birth</span>{shortDate(data.child.birthDate)}</div>
            <div><span className="inline-block w-24 text-gray-600">Milk / formula</span>{data.child.formula || "—"}</div>
            <div><span className="inline-block w-24 text-gray-600">Age group</span>{data.child.ageGroup}</div>
            <div><span className="inline-block w-24 text-gray-600">Classroom</span>{data.child.classroom || "—"}</div>
          </div>
          <p className="px-6 pb-2 text-xs italic text-gray-500">Kitchen measures portions; teacher logs service time and bottles.</p>
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className={HEAD}>
                {["Time served", "Activity", "Milk/formula", "Bottle offered (oz)", "Bottle consumed (oz)", ...Array.from({ length: cols }, (_, i) => `Component ${i + 1} / served`)].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <Fragment key={day.date}>
                  <tr className={BAND}><td colSpan={5 + cols} className="px-3 py-1 text-xs font-bold">{dayHeading(day.date)}</td></tr>
                  {day.rows.map((r, i) => (
                    <tr key={i} className={ZEBRA}>
                      <td className="px-3 py-1.5 text-right">{r.time}</td>
                      <td className="px-3 py-1.5">{r.activity}</td>
                      <td className="px-3 py-1.5">{r.milk}</td>
                      <td className="px-3 py-1.5 text-center">{r.offered}</td>
                      <td className="px-3 py-1.5 text-center">{r.consumed}</td>
                      {Array.from({ length: cols }, (_, j) => <td key={j} className="px-3 py-1.5">{r.components[j] || ""}</td>)}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!data.days.length ? <tr><td colSpan={5 + cols} className="px-3 py-6 text-center text-gray-500">No bottles, meals or infant portions were recorded for this child in this date range.</td></tr> : null}
            </tbody>
          </table>
        </ReportSheet>
      )}
    </div>
  );
}

export function MealProductionReport() {
  const { centers, centerId, setCenterId } = useReportCenters();
  const [meal, setMeal] = useState("breakfast");
  const [range, setRange] = useState(() => monthRange());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const load = useCallback(() => {
    if (!centerId) return;
    setError("");
    const qs = new URLSearchParams({ centerId, meal, ...range });
    apiJson(`/api/v1/reports/meal-production?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, meal, range]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function savePlanned(date, ageGroup, value) {
    const key = `${date}|${ageGroup}`;
    setSavingKey(key);
    try {
      const res = await apiJson("/api/v1/reports/meal-production", { method: "PUT", body: JSON.stringify({ centerId, meal, date, ageGroup, planned: value }) });
      setData((d) => ({ ...d, rows: d.rows.map((r) => (r.date === date ? { ...r, planned: { ...r.planned, [ageGroup]: res.planned } } : r)) }));
    } catch (e) {
      setError(e.message || "Failed to save the planned number");
    } finally {
      setSavingKey("");
    }
  }

  const cols = data?.componentColumns || 3;
  const groups = data?.groups || [];
  return (
    <div className="space-y-4">
      <ReportControls title="Meal Production Record">
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <label className="block text-sm font-bold">
          Meal / Snack
          <select value={meal} onChange={(e) => setMeal(e.target.value)} className={input}>
            {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <DateRange range={range} setRange={setRange} />
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <ReportSheet heading="Ameris Solutions" title={`${data.meal.label} - Production Record`} subtitle={`${longDate(data.from)} – ${longDate(data.to)}`}>
          {/* The headings stay in view while scrolling (client request 2026-10-29). */}
          <div className="max-h-[75vh] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900 print:static">
              <tr>
                <th colSpan={2 + cols} />
                <th colSpan={groups.length} className="border-x border-t border-gray-800 px-2 py-1 text-center text-xs font-bold">Planned # Served</th>
                <th colSpan={groups.length} className="border-x border-t border-gray-800 px-2 py-1 text-center text-xs font-bold">Actual # Served</th>
              </tr>
              <tr className={HEAD}>
                <th className="px-3 py-2 text-left text-xs font-bold">Service date</th>
                <th className="px-3 py-2 text-left text-xs font-bold">Day</th>
                {Array.from({ length: cols }, (_, i) => <th key={i} className="px-3 py-2 text-left text-xs font-bold">Component {i + 1}</th>)}
                {[...groups, ...groups].map((g, i) => <th key={`${g.key}-${i}`} className="px-2 py-2 text-center text-xs font-bold">Ages {g.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const d = new Date(`${r.date}T00:00:00`);
                return (
                  <tr key={r.date} className={ZEBRA}>
                    <td className="px-3 py-1 text-right">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="px-3 py-1">{d.toLocaleDateString("en-US", { weekday: "short" })}</td>
                    {Array.from({ length: cols }, (_, i) => <td key={i} className="px-3 py-1">{r.components[i] || ""}</td>)}
                    {groups.map((g) => (
                      <td key={g.key} className="px-1 py-0.5 text-center">
                        <input
                          key={`${r.date}-${g.key}-${r.planned[g.key] ?? ""}`}
                          type="number"
                          min="0"
                          defaultValue={r.planned[g.key] ?? ""}
                          disabled={savingKey === `${r.date}|${g.key}`}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value !== String(r.planned[g.key] ?? "")) savePlanned(r.date, g.key, value);
                          }}
                          aria-label={`Planned ${g.label} ${r.date}`}
                          className="w-16 rounded border border-gray-300 bg-white px-1 py-0.5 text-right text-sm print:border-0 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </td>
                    ))}
                    {groups.map((g) => <td key={g.key} className="px-2 py-1 text-right">{r.actual[g.key]}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <p className="px-6 py-2 text-xs text-gray-500">Only days the center is open are listed. Planned # served is typed in here. Actual # served counts the children whose {data.meal.label.toLowerCase()} a teacher logged on Log Activity.</p>
        </ReportSheet>
      )}
    </div>
  );
}

export function MealClaimReport() {
  const filters = useReportFilters();
  const enrolledOnly = filters.children !== "ALL";
  const { centers, centerId, setCenterId } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [view, setView] = useState("claim");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [classroom, setClassroom] = useState("");
  const classrooms = useMemo(() => [...new Set((data?.rows || []).map((r) => r.classroom).filter(Boolean))].sort(), [data]);

  useEffect(() => {
    if (!centerId) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ centerId, ...range, ...(enrolledOnly ? { enrolledOnly: "1" } : {}) });
    apiJson(`/api/v1/reports/meal-claim?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, range, enrolledOnly]);

  const toggle = (
    <div className="flex overflow-hidden rounded-lg border border-blue-300">
      {[["claim", "Meal Claim"], ["summary", "Summary"]].map(([key, label]) => (
        <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`px-4 py-2 text-sm font-bold ${view === key ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  function exportClaim() {
    const letters = data.meals;
    const rows = data.rows.filter((r) => !classroom || r.classroom === classroom);
    const headers = ["Child First Name", "Child Last Name", "Date of Birth", "Age", "Classroom", ...data.dates.flatMap((d) => letters.map((m) => `${d} ${m.letter}`)), ...letters.map((m) => `${m.label} Total`)];
    const body = rows.map((r) => [
      r.firstName,
      r.lastName,
      r.birthDate ? new Date(r.birthDate).toLocaleDateString("en-US", { timeZone: "UTC" }) : "",
      r.age,
      r.classroom,
      ...data.dates.flatMap((d) => letters.map((m) => (r.cells[`${d}|${m.key}`] ? 1 : ""))),
      ...letters.map((m) => r.totals[m.key]),
    ]);
    const summary = data.summary.meals.map((m) => [m.label, m.total, m.days, Number(m.average.toFixed(1))]);
    exportToExcel(`meal-claim-${data.from}-to-${data.to}`, [
      { name: "Meal Claim", headers, rows: body },
      { name: "Summary", headers: ["Meal type", "Total meals served", "Days meal served", "Avg meals / service day"], rows: summary },
    ]).catch((e) => setError(e.message || "Export failed"));
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {toggle}
      <button type="button" onClick={exportClaim} disabled={!data} className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
        Export to Excel
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <ReportControls title="Meal Claim" actions={actions}>
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <DateRange range={range} setRange={setRange} />
        <label className="block text-sm font-bold">
          Classroom
          <select value={classroom} onChange={(e) => setClassroom(e.target.value)} className={input}>
            <option value="">All Classrooms</option>
            {classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : view === "summary" ? (
        <ReportSheet title="Monthly Food Claim Summary" subtitle={`${longDate(data.from)} – ${longDate(data.to)}`}>
          <div className="space-y-1 px-6 pb-4 text-sm">
            <div><span className="inline-block w-56">Reporting period</span>{longDate(data.from)} – {longDate(data.to)}</div>
            <div><span className="inline-block w-56">Children on roster</span><b>{data.summary.childrenOnRoster}</b></div>
            <div><span className="inline-block w-56">Days any meal was served</span><b>{data.summary.daysAnyMealServed}</b></div>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={HEAD}>
                {["Meal type", "Total meals served", "Days meal served", "Avg meals / service day"].map((h) => <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.summary.meals.map((m) => (
                <tr key={m.meal} className={ZEBRA}>
                  <td className="px-4 py-1.5">{m.label}</td>
                  <td className="px-4 py-1.5 text-right">{m.total}</td>
                  <td className="px-4 py-1.5 text-right">{m.days}</td>
                  <td className="px-4 py-1.5 text-right">{m.average.toFixed(1)}</td>
                </tr>
              ))}
              <tr className="bg-emerald-50 font-bold text-[#16305e] dark:bg-gray-800 dark:text-blue-100">
                <td className="px-4 py-2">ALL MEALS — TOTAL</td>
                <td className="px-4 py-2 text-right">{data.summary.total}</td>
                <td className="px-4 py-2 text-right">{data.summary.daysAnyMealServed}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </ReportSheet>
      ) : (
        <MealClaimSheet data={data} classroom={classroom} />
      )}
    </div>
  );
}

const SORTS = [
  ["firstName", "Child First Name"],
  ["lastName", "Child Last Name"],
  ["birthDate", "Date of Birth"],
  ["classroom", "Classroom"],
];
// Widths of the pinned child columns, so each sticks just right of the last.
const PIN = [{ left: 0, w: 110 }, { left: 110, w: 110 }, { left: 220, w: 90 }, { left: 310, w: 44 }, { left: 354, w: 120 }];

function MealClaimSheet({ data, classroom = "" }) {
  const letters = data.meals;
  const [sort, setSort] = useState({ key: "firstName", dir: 1 });
  const rows = useMemo(() => {
    const list = data.rows.filter((r) => !classroom || r.classroom === classroom);
    const val = (r) => (sort.key === "birthDate" ? (r.birthDate ? new Date(r.birthDate).getTime() : 0) : String(r[sort.key] || "").toLowerCase());
    return list.slice().sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [data.rows, classroom, sort]);
  const pinStyle = (i) => ({ position: "sticky", left: PIN[i].left, minWidth: PIN[i].w, maxWidth: PIN[i].w });
  const dayLabel = (key) => {
    const d = new Date(`${key}T00:00:00`);
    return `${d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} ${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })}`;
  };
  const cell = "border-l border-gray-200 px-1 py-1 text-center dark:border-gray-700";
  return (
    <ReportSheet title="Meal Claim" subtitle={`${longDate(data.from)} – ${longDate(data.to)}`}>
      {/* Child columns stay put when scrolling across the dates, and the date and
          meal headings stay put when scrolling down (client request 2026-10-29). */}
      <div className="max-h-[75vh] overflow-auto print:max-h-none print:overflow-visible">
      <table className="border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20 print:static">
          <tr className={HEAD}>
            {["Child First Name", "Child Last Name", "Date of Birth", "Age", "Classroom"].map((h, i) => {
              const key = SORTS.find(([, label]) => label === h)?.[0];
              return (
                <th key={h} rowSpan={2} style={pinStyle(i)} className={`z-30 whitespace-nowrap bg-[#16305e] px-2 py-1 text-left font-bold print:static`}>
                  {key ? (
                    <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))} className="inline-flex items-center gap-1" aria-label={`Sort by ${h}`}>
                      {h}
                      <span aria-hidden>{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : (
                    h
                  )}
                </th>
              );
            })}
            {data.dates.map((d) => <th key={d} colSpan={letters.length} className="border-l border-white/40 px-1 py-1 text-center font-bold">{dayLabel(d)}</th>)}
            {letters.map((m) => <th key={m.key} rowSpan={2} className="border-l border-white/40 px-1 py-1 text-center font-bold">{m.label} Total</th>)}
          </tr>
          <tr className={HEAD}>
            {data.dates.map((d) => letters.map((m) => <th key={`${d}-${m.key}`} className="w-5 border-l border-white/20 px-1 py-0.5 text-center font-semibold">{m.letter}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={ZEBRA}>
              {[r.firstName, r.lastName, r.birthDate ? new Date(r.birthDate).toLocaleDateString("en-US", { timeZone: "UTC" }) : "", r.age, r.classroom].map((v, i) => (
                <td key={i} style={pinStyle(i)} className={`z-10 truncate whitespace-nowrap bg-white px-2 py-1 dark:bg-gray-900 print:static ${i === 2 || i === 3 ? "text-right" : ""}`}>{v}</td>
              ))}
              {data.dates.map((d) => letters.map((m) => <td key={`${d}-${m.key}`} className={cell}>{r.cells[`${d}|${m.key}`] ? 1 : ""}</td>))}
              {letters.map((m) => <td key={m.key} className={`${cell} font-semibold`}>{r.totals[m.key]}</td>)}
            </tr>
          ))}
          <tr className="bg-emerald-50 font-bold dark:bg-gray-800">
            <td colSpan={5} className="px-2 py-1">TOTAL MEALS SERVED</td>
            {data.dates.map((d) => letters.map((m) => <td key={`${d}-${m.key}`} className={cell}>{data.dayTotals[`${d}|${m.key}`]}</td>))}
            {data.summary.meals.map((m) => <td key={m.meal} className={cell}>{m.total}</td>)}
          </tr>
          <tr className="border-t border-gray-300 font-semibold">
            <td colSpan={5} className="px-2 py-1">ANY MEAL SERVED THAT DAY (1 / blank)</td>
            {data.dates.map((d) => <td key={d} colSpan={letters.length} className={cell}>{data.anyMealDays.includes(d) ? 1 : ""}</td>)}
            <td colSpan={letters.length} className={cell}>{data.summary.daysAnyMealServed}</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p className={`px-6 py-2 text-xs text-gray-500 ${NAVY}`}>A 1 means a teacher logged that meal or snack for the child on Log Activity. B Breakfast · A AM Snack · L Lunch · P PM Snack · D Dinner · E Evening Snack.</p>
    </ReportSheet>
  );
}
