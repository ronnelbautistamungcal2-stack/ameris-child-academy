import { CenterSelect, NAVY, ReportControls, ReportMessage, ReportSheet, input, longDate, monthRange, shortDate, useReportCenters } from "@/components/reports/ReportSheet";
import { apiJson } from "@/lib/api";
import { MEALS } from "@/lib/menuPlan";
import { Fragment, useCallback, useEffect, useState } from "react";

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
  const { centers, centerId, setCenterId } = useReportCenters();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [range, setRange] = useState(() => monthRange());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

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
          Child
          <select value={childId} onChange={(e) => setChildId(e.target.value)} className={input}>
            <option value="">Select a child...</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}{c.enrolled ? "" : " (not enrolled)"}</option>)}
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
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
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
          <p className="px-6 py-2 text-xs text-gray-500">Planned # served is typed in here. Actual # served counts the children whose {data.meal.label.toLowerCase()} a teacher logged on Log Activity.</p>
        </ReportSheet>
      )}
    </div>
  );
}

export function MealClaimReport() {
  const { centers, centerId, setCenterId } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [view, setView] = useState("claim");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ centerId, ...range });
    apiJson(`/api/v1/reports/meal-claim?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, range]);

  const toggle = (
    <div className="flex overflow-hidden rounded-lg border border-blue-300">
      {[["claim", "Meal Claim"], ["summary", "Summary"]].map(([key, label]) => (
        <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`px-4 py-2 text-sm font-bold ${view === key ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <ReportControls title="Meal Claim" actions={toggle}>
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <DateRange range={range} setRange={setRange} />
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
        <MealClaimSheet data={data} />
      )}
    </div>
  );
}

function MealClaimSheet({ data }) {
  const letters = data.meals;
  const dayLabel = (key) => {
    const d = new Date(`${key}T00:00:00`);
    return `${d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} ${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })}`;
  };
  const cell = "border-l border-gray-200 px-1 py-1 text-center dark:border-gray-700";
  return (
    <ReportSheet title="Meal Claim" subtitle={`${longDate(data.from)} – ${longDate(data.to)}`}>
      <table className="border-collapse text-xs">
        <thead>
          <tr className={HEAD}>
            {["Child First Name", "Child Last Name", "Date of Birth", "Age", "Classroom"].map((h) => <th key={h} rowSpan={2} className="whitespace-nowrap px-2 py-1 text-left font-bold">{h}</th>)}
            {data.dates.map((d) => <th key={d} colSpan={letters.length} className="border-l border-white/40 px-1 py-1 text-center font-bold">{dayLabel(d)}</th>)}
            {letters.map((m) => <th key={m.key} rowSpan={2} className="border-l border-white/40 px-1 py-1 text-center font-bold">{m.label} Total</th>)}
          </tr>
          <tr className={HEAD}>
            {data.dates.map((d) => letters.map((m) => <th key={`${d}-${m.key}`} className="w-5 border-l border-white/20 px-1 py-0.5 text-center font-semibold">{m.letter}</th>))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id} className={ZEBRA}>
              <td className="whitespace-nowrap px-2 py-1">{r.firstName}</td>
              <td className="whitespace-nowrap px-2 py-1">{r.lastName}</td>
              <td className="whitespace-nowrap px-2 py-1 text-right">{r.birthDate ? new Date(r.birthDate).toLocaleDateString("en-US", { timeZone: "UTC" }) : ""}</td>
              <td className="px-2 py-1 text-right">{r.age}</td>
              <td className="whitespace-nowrap px-2 py-1">{r.classroom}</td>
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
      <p className={`px-6 py-2 text-xs text-gray-500 ${NAVY}`}>A 1 means a teacher logged that meal or snack for the child on Log Activity. B Breakfast · A AM Snack · L Lunch · P PM Snack · D Dinner · E Evening Snack.</p>
    </ReportSheet>
  );
}
