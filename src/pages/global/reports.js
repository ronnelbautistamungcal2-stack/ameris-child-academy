import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { money } from "@/lib/subscriptionPricing";

// Global admin > Reports (client mockups 2026-11-06): Subscription, Revenue,
// Outstanding Payments, Sales Pipeline, Customer Support, Add-On, Activity
// Log. Each has a date range, Print and Export (CSV).

const COLORS = ["#0b3a8a", "#1e88e5", "#90caf9", "#2e7d32", "#f9a825", "#bdbdbd", "#7e57c2"];
const card = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
const button =
  "rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const PAGE = 25;

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const monthEnd = () => {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
};

function show(value, isMoney) {
  if (value === null || value === undefined || value === "") return "—";
  return isMoney && typeof value === "number" ? money(value) : value;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(report) {
  const cols = report.columns;
  const lines = [cols.map((c) => csvCell(c.label)).join(",")];
  const fmt = (c, v) => (c.money && typeof v === "number" ? (v / 100).toFixed(2) : v);
  for (const r of report.rows) lines.push(cols.map((c) => csvCell(fmt(c, r[c.key]))).join(","));
  if (report.totals) lines.push(cols.map((c) => csvCell(fmt(c, report.totals[c.key]))).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${report.key}-${report.from}-to-${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PieCard({ chart }) {
  const total = chart.data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={`${card} p-4`}>
      <h3 className="mb-2 font-serif text-lg font-bold text-[#0b2a5b] dark:text-blue-100">{chart.title}</h3>
      {total ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-48 w-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chart.data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={85} paddingAngle={1} isAnimationActive={false}>
                  {chart.data.map((d, i) => (
                    <Cell key={d.label} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => (chart.money ? money(v) : v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-sm">
            {chart.data.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                {d.label} – {Math.round((d.value * 100) / total)}% ({chart.money ? money(d.value) : d.value})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-gray-500">No data in this range.</p>
      )}
    </div>
  );
}

function BarsCard({ chart }) {
  return (
    <div className={`${card} p-4`}>
      <h3 className="mb-2 font-serif text-lg font-bold text-[#0b2a5b] dark:text-blue-100">{chart.title}</h3>
      <div className="h-48">
        <ResponsiveContainer>
          <BarChart data={chart.data} layout="vertical" margin={{ left: 20, right: 30 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1e88e5" isAnimationActive={false} label={{ position: "right", fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BreakdownCard({ chart }) {
  const total = chart.data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={`${card} p-4`}>
      <h3 className="mb-2 font-serif text-lg font-bold text-[#0b2a5b] dark:text-blue-100">{chart.title}</h3>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-gray-200 font-bold">
            <td className="py-1.5">Total</td>
            <td className="py-1.5 text-right">{chart.money ? money(total) : total}</td>
          </tr>
          {chart.data.map((d) => (
            <tr key={d.label} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1.5">{d.label}</td>
              <td className="py-1.5 text-right">{chart.money ? money(d.value) : d.value}</td>
            </tr>
          ))}
          {!chart.data.length ? (
            <tr>
              <td className="py-4 text-center text-gray-500" colSpan={2}>
                No open quotes in this range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default function GlobalReportsPage() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [key, setKey] = useState("subscriptions");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiJson("/api/v1/global/reports")
      .then((d) => setList(d.reports))
      .catch((e) => setError(e.message || "Could not load the reports"));
  }, []);
  useEffect(() => {
    if (router.isReady && typeof router.query.report === "string") setKey(router.query.report);
  }, [router.isReady, router.query.report]);
  useEffect(() => {
    // Wait for the address (?report=) and ignore answers to older requests,
    // so a slow earlier report never replaces the one picked.
    if (!router.isReady || !from || !to) return undefined;
    let current = true;
    setLoading(true);
    setError("");
    apiJson(`/api/v1/global/reports?${new URLSearchParams({ report: key, from, to })}`, { timeoutMs: 120000 })
      .then((r) => {
        if (!current) return;
        setReport(r);
        setPage(1);
      })
      .catch((e) => current && setError(e.message || "Could not load the report"))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [router.isReady, key, from, to]);

  const pages = Math.max(1, Math.ceil((report?.rows.length || 0) / PAGE));
  const shown = useMemo(() => (report ? report.rows.slice((page - 1) * PAGE, page * PAGE) : []), [report, page]);

  return (
    <GlobalLayout title="Reports">
      <h1 className="mb-4 text-3xl font-extrabold text-gray-900 print:hidden dark:text-gray-100">Reports</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_1fr]">
        <nav aria-label="Report List" className={`${card} h-fit p-3 print:hidden`}>
          <h2 className="mb-2 px-2 font-serif text-xl font-bold text-[#0b2a5b] dark:text-blue-100">Report List</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => setKey(r.key)}
                  aria-current={key === r.key ? "page" : undefined}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${key === r.key ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100" : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"}`}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-[#0b2a5b] dark:text-blue-100">{report?.label || list.find((r) => r.key === key)?.label || "Report"}</h2>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">From</span>
                <input type="date" className={button} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              </label>
              <span aria-hidden="true">–</span>
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">To</span>
                <input type="date" className={button} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </label>
              <button type="button" className={button} onClick={() => window.print()} disabled={!report}>
                Print
              </button>
              <button type="button" className={button} onClick={() => exportCsv(report)} disabled={!report?.rows.length}>
                Export
              </button>
            </div>
            <p className="hidden w-full text-sm text-gray-600 print:block">
              {from} to {to}
            </p>
          </div>
          {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {!report ? (
            <p className="py-10 text-center text-sm text-gray-500">{loading ? "Loading..." : ""}</p>
          ) : (
            <div className={loading ? "opacity-60" : ""}>
              <div className="mt-4 grid grid-cols-2 divide-gray-200 rounded-xl border border-gray-200 sm:grid-cols-3 lg:flex lg:divide-x dark:border-gray-700 dark:divide-gray-700">
                {report.stats.map((s) => (
                  <div key={s.label} className="flex-1 px-4 py-3 text-center">
                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300">{s.label}</div>
                    <div className="mt-1 font-serif text-2xl font-bold text-gray-900 dark:text-gray-100">{show(s.value, s.money)}</div>
                  </div>
                ))}
              </div>

              {report.charts ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {report.charts.pie ? <PieCard chart={report.charts.pie} /> : null}
                  {report.charts.bars ? <BarsCard chart={report.charts.bars} /> : null}
                  {report.charts.breakdown ? <BreakdownCard chart={report.charts.breakdown} /> : null}
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-blue-50 text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                        {report.columns.map((c) => (
                          <td key={c.key} className={`px-3 py-1.5 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                            {show(r[c.key], c.money)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!report.rows.length ? (
                      <tr>
                        <td colSpan={report.columns.length} className="px-3 py-8 text-center text-gray-500">
                          Nothing to show for this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  {report.totals && report.rows.length ? (
                    <tfoot className="bg-blue-50 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                      <tr>
                        {report.columns.map((c) => (
                          <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                            {show(report.totals[c.key], c.money)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span>
                  Showing {report.rows.length ? (page - 1) * PAGE + 1 : 0} – {Math.min(page * PAGE, report.rows.length)} of {report.rows.length}
                </span>
                {pages > 1 ? (
                  <span className="flex gap-1 print:hidden">
                    <button type="button" className={button} disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                      ‹
                    </button>
                    <span className="px-2 py-2">
                      {page} / {pages}
                    </span>
                    <button type="button" className={button} disabled={page === pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                      ›
                    </button>
                  </span>
                ) : null}
              </div>
              {report.note ? <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{report.note}</p> : null}
            </div>
          )}
        </section>
      </div>
    </GlobalLayout>
  );
}
