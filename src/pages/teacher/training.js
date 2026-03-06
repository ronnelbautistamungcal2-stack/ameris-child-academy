import TeacherLayout from "@/components/teacher/TeacherLayout";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function TeacherTraining() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [metrics, setMetrics] = useState(null);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("training");
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, m] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/metrics/me").catch(() => null),
        ]);
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
        setMetrics(m);
      } catch (e) {
        setError(e.message || "Failed to load training data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setPlans([]);
        return;
      }
      setLoadingPlans(true);
      setError("");
      try {
        const today = startOfDay(new Date());
        const week = startOfWeekMonday(new Date());
        const [daily, weekly] = await Promise.all([
          apiJson(
            `/api/v1/milestone-checklists?centerId=${encodeURIComponent(centerId)}&period=DAY&start=${encodeURIComponent(
              today.toISOString(),
            )}`,
          ).catch(() => []),
          apiJson(
            `/api/v1/milestone-checklists?centerId=${encodeURIComponent(centerId)}&period=WEEK&start=${encodeURIComponent(
              week.toISOString(),
            )}`,
          ).catch(() => []),
        ]);
        const merged = [
          ...(Array.isArray(daily) ? daily : []),
          ...(Array.isArray(weekly) ? weekly : []),
        ];
        setPlans(merged);
      } catch (e) {
        setError(e.message || "Failed to load training pathway");
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    if (tab !== "career-ladder") return;
    (async () => {
      setLoadingRecords(true);
      try {
        const data = await apiJson("/api/v1/teacher-records");
        setRecords(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || "Failed to load career records");
      } finally {
        setLoadingRecords(false);
      }
    })();
  }, [tab]);

  const sortedPlans = useMemo(() => {
    return (plans || [])
      .slice()
      .sort((a, b) => {
        const cmpPeriod = byString(a.period, b.period);
        if (cmpPeriod !== 0) return cmpPeriod;
        return new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime();
      })
      .slice(0, 6);
  }, [plans]);

  return (
    <TeacherLayout title="My Performance & Training">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                My Performance & Training
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Teacher metrics, training pathway, and career ladder.
              </p>
            </div>

            {tab === "training" ? (
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a center…</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2 border-b border-gray-200 pb-0">
            <button
              type="button"
              onClick={() => setTab("training")}
              className={[
                "px-4 py-2 text-sm font-semibold border-b-2 transition",
                tab === "training"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Performance & Training
            </button>
            <button
              type="button"
              onClick={() => setTab("career-ladder")}
              className={[
                "px-4 py-2 text-sm font-semibold border-b-2 transition",
                tab === "career-ladder"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Career Ladder
            </button>
            <button
              type="button"
              onClick={() => setTab("training-hours")}
              className={[
                "px-4 py-2 text-sm font-semibold border-b-2 transition",
                tab === "training-hours"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Training Hours
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {tab === "training" && (
            <>
              {loading ? (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Teacher metrics
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Based on your activity logs (more metrics can be added).
                    </p>

                    {metrics ? (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Metric label="Activities (Today)" value={metrics.activities?.today ?? 0} />
                        <Metric label="Activities (This Week)" value={metrics.activities?.week ?? 0} />
                        <Metric label="Activities (Last 30 Days)" value={metrics.activities?.last30Days ?? 0} />
                        <Metric label="Children Accessible" value={metrics.access?.children ?? 0} />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        Metrics not available.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Training pathway
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Daily/weekly pathway items linked to policies, procedures, videos, and lessons.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Link
                        href="/teacher/lessons"
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Lesson Plans & Media
                      </Link>
                      <Link
                        href="/teacher/milestone-checklists"
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Training Pathway View
                      </Link>
                    </div>

                    {!centerId ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        Select a center to preview today's training pathway.
                      </div>
                    ) : loadingPlans ? (
                      <div className="mt-3"><Skeleton count={3} /></div>
                    ) : sortedPlans.length ? (
                      <div className="mt-3 space-y-2">
                        {sortedPlans.map((p) => (
                          <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-sm font-extrabold text-gray-900">
                              {p.title}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {p.period} • {new Date(p.periodStart).toLocaleDateString()} •{" "}
                              {(p.items || []).length} items
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        No pathway plans found for today/this week.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "career-ladder" && (
            <CareerLadderPanel records={records} loading={loadingRecords} />
          )}

          {tab === "training-hours" && (
            <TrainingHoursPanel centerId={centerId} />
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

const TYPE_CONFIG = {
  EMPLOYEE_OF_THE_MONTH: {
    label: "Employee of the Month",
    pillClass: "border-amber-200 bg-amber-50",
    pillText: "text-amber-800",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
  CERTIFICATE: {
    label: "Certificates & Training",
    pillClass: "border-emerald-200 bg-emerald-50",
    pillText: "text-emerald-800",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
  },
  ACHIEVEMENT: {
    label: "Achievements",
    pillClass: "border-blue-200 bg-blue-50",
    pillText: "text-blue-800",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
  },
  CAREER_LADDER: {
    label: "Career Milestones",
    pillClass: "border-violet-200 bg-violet-50",
    pillText: "text-violet-800",
    iconBg: "bg-violet-100",
    iconText: "text-violet-700",
  },
};

function CareerLadderPanel({ records, loading }) {
  if (loading) return <div className="mt-4"><Skeleton count={4} /></div>;

  if (!records.length) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No career ladder records yet. These are managed by your administrator.
      </div>
    );
  }

  const grouped = {
    EMPLOYEE_OF_THE_MONTH: records.filter((r) => r.type === "EMPLOYEE_OF_THE_MONTH"),
    CERTIFICATE: records.filter((r) => r.type === "CERTIFICATE"),
    ACHIEVEMENT: records.filter((r) => r.type === "ACHIEVEMENT"),
    CAREER_LADDER: records.filter((r) => r.type === "CAREER_LADDER"),
  };

  return (
    <div className="mt-5 space-y-4">
      {Object.entries(grouped).map(([type, items]) => {
        if (!items.length) return null;
        const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.ACHIEVEMENT;
        return (
          <div key={type} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {cfg.label}
            </div>
            <div className="mt-3 space-y-2">
              {items.map((record) => (
                <div
                  key={record.id}
                  className={[
                    "rounded-xl border p-3",
                    cfg.pillClass,
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={["text-sm font-extrabold", cfg.pillText].join(" ")}>
                        {record.title}
                      </div>
                      {record.description ? (
                        <p className="mt-1 text-xs text-gray-600">{record.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-xs text-gray-500">
                      {new Date(record.date).toLocaleDateString()}
                    </div>
                  </div>
                  {record.fileUrl ? (
                    <a
                      href={record.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block rounded-lg bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200"
                    >
                      View Certificate{record.fileName ? ` (${record.fileName})` : ""}
                    </a>
                  ) : null}
                  {record.createdBy ? (
                    <div className="mt-1 text-[11px] text-gray-400">
                      Added by {record.createdBy.name || record.createdBy.email}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TRAINING_CATEGORIES = ["Orientation", "Safety", "Curriculum", "Professional Development", "Other"];

function TrainingHoursPanel({ centerId }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ topic: "", description: "", hours: "", date: new Date().toISOString().split("T")[0], category: "Other" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = centerId ? `centerId=${encodeURIComponent(centerId)}` : "";
      const [logsData, summaryData] = await Promise.all([
        apiJson(`/api/v1/training-logs?${qs}`),
        apiJson(`/api/v1/training-logs/summary?${qs}`),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData);
    } catch {} finally { setLoading(false); }
  }, [centerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.topic || !form.hours) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId: centerId || undefined,
          topic: form.topic,
          description: form.description || null,
          hours: parseFloat(form.hours),
          date: form.date,
          category: form.category,
        }),
      });
      setShowForm(false);
      setForm({ topic: "", description: "", hours: "", date: new Date().toISOString().split("T")[0], category: "Other" });
      loadData();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="mt-5 space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Total Hours" value={summary.totalHours || 0} />
          {Object.entries(summary.byCategory || {}).map(([cat, hrs]) => (
            <Metric key={cat} label={cat} value={hrs} />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">My Training Log</div>
          <button onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            {showForm ? "Cancel" : "Log Training"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Topic</div>
              <input type="text" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
            </label>
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hours</div>
              <input type="number" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
            </label>
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</div>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</div>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                {TRAINING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description (optional)</div>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="mt-3"><Skeleton count={3} /></div>
        ) : logs.length === 0 ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No training hours logged yet.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-gray-900">{l.topic}</div>
                  <div className="text-xs text-gray-500">{l.hours}h &middot; {new Date(l.date).toLocaleDateString()}</div>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {l.category}
                  {l.description && <span className="ml-2">&middot; {l.description}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
    </div>
  );
}
