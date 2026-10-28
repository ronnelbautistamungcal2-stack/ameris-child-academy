import { CenterSelect, NAVY, ReportControls, ReportMessage, ReportSheet, input, longDate, useReportCenters } from "@/components/reports/ReportSheet";
import { isCurrentlyEnrolled, useReportFilters } from "@/components/reports/ReportFilters";
import { apiJson } from "@/lib/api";
import { localDateKey } from "@/lib/foodReports";
import { SOP_STATUSES } from "@/lib/sop";
import { useEffect, useMemo, useState } from "react";

// Milestone Progress Report (center average vs. world standard) and Child
// Steps of Progression Report (one child vs. the center and the world
// standard), client requests 2026-10-23 and 2026-10-28: Competency and Mastery
// in their own columns, the five SOP statuses, and the age range picks the
// children by their age on the report date. Both group the steps by category
// like the client's sheet.

const AGE_OPTIONS = [0, 3, 6, 9, 12, 18, 24, 30, 36, 48, 60, 72, 96, 120, 144];
const CATEGORY_TONES = [
  "bg-red-100 text-[#0b2a5b]",
  "bg-blue-100 text-[#0b2a5b]",
  "bg-green-100 text-[#0b2a5b]",
  "bg-amber-100 text-[#0b2a5b]",
  "bg-violet-100 text-[#0b2a5b]",
  "bg-cyan-100 text-[#0b2a5b]",
];
const ageLabel = (m) => (m < 24 ? `${m} months` : `${m / 12} years`);
const fmt = (n) => (n == null ? "—" : n.toFixed(1));
const diff = (n) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}`);

function useFilters() {
  return useState({ date: localDateKey(new Date()), minMonths: "", maxMonths: "", categoryId: "", subCategory: "", competency: "", mastery: "" });
}

function FilterFields({ filters, setFilters, options, showLevels }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const category = options.find((c) => c.id === filters.categoryId);
  return (
    <>
      <label className="block text-sm font-bold">
        Report Date
        <input type="date" value={filters.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-bold">
          Children&apos;s Age From
          <select value={filters.minMonths} onChange={(e) => set({ minMonths: e.target.value })} className={input}>
            <option value="">Any</option>
            {AGE_OPTIONS.map((m) => <option key={m} value={m}>{ageLabel(m)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Children&apos;s Age To
          <select value={filters.maxMonths} onChange={(e) => set({ maxMonths: e.target.value })} className={input}>
            <option value="">Any</option>
            {AGE_OPTIONS.filter((m) => m > 0).map((m) => <option key={m} value={m}>{ageLabel(m)}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-bold">
        Category
        <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value, subCategory: "" })} className={input}>
          <option value="">All Categories</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-bold">
        Sub Category
        <select value={filters.subCategory} onChange={(e) => set({ subCategory: e.target.value })} disabled={!category?.subCategories.length} className={input}>
          <option value="">All Sub Categories</option>
          {(category?.subCategories || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {showLevels ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["competency", "Competency"],
            ["mastery", "Mastery"],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm font-bold">
              {label}
              <select value={filters[key]} onChange={(e) => set({ [key]: e.target.value })} className={input}>
                <option value="">All Steps</option>
                <option value="yes">Reached</option>
                <option value="no">Not Reached</option>
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </>
  );
}

function query(filters, extra) {
  const qs = new URLSearchParams(extra);
  for (const key of ["date", "minMonths", "maxMonths", "categoryId", "subCategory", "competency", "mastery"]) if (filters[key] !== "") qs.set(key, filters[key]);
  return qs.toString();
}

function ageRangeText(filters) {
  if (filters.minMonths === "" && filters.maxMonths === "") return "All ages";
  const min = filters.minMonths === "" ? 0 : Number(filters.minMonths);
  if (filters.maxMonths === "") return `${ageLabel(min)} and up on the report date`;
  return `${min} – ${filters.maxMonths} months on the report date`;
}

function StepTable({ categories, columns, cells }) {
  return (
    <table className="w-full min-w-[960px] border-collapse text-sm">
      <thead>
        <tr className={`border-y-2 border-blue-200 ${NAVY}`}>
          <th className="px-3 py-2 text-left text-base font-black">Category/Goal</th>
          {columns.map((c) => <th key={c} className="w-28 border-l border-blue-200 px-2 py-2 text-center text-xs font-black">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {categories.map((cat, i) => (
          <CategoryRows key={cat.id || "none"} cat={cat} tone={CATEGORY_TONES[i % CATEGORY_TONES.length]} span={columns.length + 1} cells={cells} />
        ))}
      </tbody>
    </table>
  );
}

function CategoryRows({ cat, tone, span, cells }) {
  return (
    <>
      <tr>
        <td colSpan={span} className={`px-3 py-1.5 text-lg font-black ${tone}`} style={{ fontFamily: "Georgia, serif" }}>{cat.name}</td>
      </tr>
      {cat.rows.map((row) => (
        <tr key={row.id} className="border-b border-gray-200 dark:border-gray-700">
          <td className="px-3 py-1">
            {row.title}
            {row.subCategory ? <span className="ml-2 text-xs text-gray-500">({row.subCategory})</span> : null}
          </td>
          {cells(row).map((cell, i) => (
            <td key={i} className={`border-l border-gray-200 px-2 py-1 text-center dark:border-gray-700 ${cell.className || ""}`}>{cell.value}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

function statusCell(status) {
  const meta = SOP_STATUSES.find((s) => s.value === status);
  if (!meta) return { value: "—", className: "text-gray-400" };
  return { value: <span className={`inline-block min-w-[5.5rem] rounded px-2 py-0.5 text-xs font-semibold ${meta.pill}`}>{meta.label}</span> };
}

/** The child's age at a level, with the date it was checked off underneath. */
function reachedCell(level) {
  if (!level) return { value: "—" };
  return {
    value: (
      <>
        <span className="font-semibold">{fmt(level.years)}</span>
        <span className="block text-[11px] text-gray-500">{new Date(level.at).toLocaleDateString("en-US")}</span>
      </>
    ),
  };
}

export function MilestoneProgressReport() {
  const reportFilters = useReportFilters();
  const enrolledOnly = reportFilters.children !== "ALL";
  const { centers, centerId, setCenterId } = useReportCenters();
  const [filters, setFilters] = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return;
    setError("");
    apiJson(`/api/v1/reports/milestone-progress?${query(filters, { centerId, ...(enrolledOnly ? { enrolledOnly: "1" } : {}) })}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, filters, enrolledOnly]);

  return (
    <div className="space-y-4">
      <ReportControls title="Milestone Progress Report">
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <FilterFields filters={filters} setFilters={setFilters} options={data?.filters || []} />
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <ReportSheet
          title="Milestone Progress Report"
          subtitle="Center Average vs. World Standard"
          copyright
          meta={[
            ["Report Date", longDate(data.date)],
            ["Age Range", ageRangeText(filters)],
            ["Children in Range", data.childrenInRange],
            ["Children Reaching a Step", data.totalChildren],
            ["World Standard", "Steps of Progression age ranges"],
          ]}
        >
          {data.categories.length ? (
            <StepTable
              categories={data.categories}
              columns={["Center Competency (avg. years)", "Center Mastery (avg. years)", "World Standard Average Age (years)", "Difference (years)", "Status"]}
              cells={(r) => [{ value: fmt(r.competencyYears) }, { value: fmt(r.masteryYears) }, { value: fmt(r.worldYears) }, { value: diff(r.difference) }, statusCell(r.status)]}
            />
          ) : (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No steps with ages match these filters.</p>
          )}
        </ReportSheet>
      )}
    </div>
  );
}

export function ChildStepsReport({ parent = false }) {
  const reportFilters = useReportFilters();
  const { centers, centerId, setCenterId } = useReportCenters();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [filters, setFilters] = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!parent && !centerId) return;
    apiJson(`/api/v1/reports/child-steps${parent ? "" : `?centerId=${encodeURIComponent(centerId)}`}`)
      .then((res) => {
        setChildren(res.children || []);
        setChildId((current) => (res.children.some((c) => c.id === current) ? current : res.children.length === 1 ? res.children[0].id : ""));
      })
      .catch((e) => setError(e.message || "Failed to load children"));
  }, [parent, centerId]);

  useEffect(() => {
    if (!childId) return setData(null);
    setError("");
    apiJson(`/api/v1/reports/child-steps?${query(filters, { childId })}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [childId, filters]);

  const child = useMemo(() => children.find((c) => c.id === childId), [children, childId]);

  return (
    <div className="space-y-4">
      <ReportControls title="Child Steps of Progression Report">
        {!parent ? <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} /> : null}
        <label className="block text-sm font-bold">
          Child
          <select value={childId} onChange={(e) => setChildId(e.target.value)} className={input}>
            <option value="">Select a child...</option>
            {children
              .filter((c) => parent || reportFilters.children === "ALL" || isCurrentlyEnrolled(c) || c.id === childId)
              .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <FilterFields filters={filters} setFilters={setFilters} options={data?.filters || []} showLevels />
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!childId ? (
        <ReportMessage>{!parent && !centerId ? "Choose a center and a child to generate the report." : "Choose a child to generate the report."}</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <ReportSheet
          title="Child Steps of Progression Report"
          subtitle="Milestone Achievement — Center and World Standard"
          copyright
          meta={[
            ["Report Date", longDate(data.date)],
            ["Child", child?.name || data.child.name],
            ["Date of Birth", longDate(data.child.birthDate)],
            ["Age at Report", data.child.ageYears != null ? `${data.child.ageYears.toFixed(1)} years` : "—"],
            ["Center Age Range", ageRangeText(filters)],
            ["Steps at Competency", `${data.competencyCount} of ${data.totalSteps}`],
            ["Steps at Mastery", `${data.masteryCount} of ${data.totalSteps}`],
          ]}
        >
          {data.categories.length ? (
            <StepTable
              categories={data.categories}
              columns={[
                "Child's Competency (years)",
                "Center Competency (avg. years)",
                "Child's Mastery (years)",
                "Center Mastery (avg. years)",
                "World Standard Average Age (years)",
                "Difference (Center)",
                "Difference (World)",
                "Center Status",
                "World Status",
              ]}
              cells={(r) => [
                reachedCell(r.competency),
                { value: fmt(r.centerCompetencyYears) },
                reachedCell(r.mastery),
                { value: fmt(r.centerMasteryYears) },
                { value: fmt(r.worldYears) },
                { value: diff(r.centerDifference) },
                { value: diff(r.worldDifference) },
                statusCell(r.centerStatus),
                statusCell(r.worldStatus),
              ]}
            />
          ) : (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No steps with ages match these filters.</p>
          )}
        </ReportSheet>
      )}
    </div>
  );
}
