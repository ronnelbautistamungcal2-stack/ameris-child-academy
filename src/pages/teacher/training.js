import TeacherLayout from "@/components/teacher/TeacherLayout";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";

function formatDateLabel(value, options) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, options || { month: "short", day: "numeric", year: "numeric" });
}

function formatEvaluationStatus(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const [evaluations, setEvaluations] = useState([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState("");

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
        const data = await apiJson(
          `/api/v1/teacher-training-pathways?centerId=${encodeURIComponent(centerId)}`,
        ).catch(() => []);
        setPlans(Array.isArray(data) ? data : []);
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

  const loadEvaluations = useCallback(async () => {
    setLoadingEvaluations(true);
    setError("");
    try {
      const qs = centerId ? `?centerId=${encodeURIComponent(centerId)}` : "";
      const data = await apiJson(`/api/v1/evaluations${qs}`);
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load evaluations");
    } finally {
      setLoadingEvaluations(false);
    }
  }, [centerId]);

  useEffect(() => {
    if (tab !== "evaluations") return;
    loadEvaluations();
  }, [loadEvaluations, tab]);

  const sortedPlans = useMemo(() => {
    return (plans || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.effectiveDate || b.createdAt).getTime() -
          new Date(a.effectiveDate || a.createdAt).getTime(),
      )
      .slice(0, 6);
  }, [plans]);

  const visibleEvaluations = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status !== "DRAFT"),
    [evaluations],
  );

  const handleAcknowledgeEvaluation = async (evaluationId) => {
    setAcknowledgingId(evaluationId);
    setError("");
    try {
      await apiJson(`/api/v1/evaluations/${evaluationId}/acknowledge`, { method: "POST" });
      await loadEvaluations();
      const refreshedMetrics = await apiJson("/api/v1/metrics/me").catch(() => null);
      if (refreshedMetrics) setMetrics(refreshedMetrics);
    } catch (e) {
      setError(e.message || "Failed to acknowledge evaluation");
    } finally {
      setAcknowledgingId("");
    }
  };

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
                Teacher metrics, training pathway, evaluations, and career ladder.
              </p>
            </div>

            {tab !== "career-ladder" ? (
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
                  <option value="">All centers</option>
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
              onClick={() => setTab("evaluations")}
              className={[
                "px-4 py-2 text-sm font-semibold border-b-2 transition",
                tab === "evaluations"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Evaluations
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
                      Teacher-specific pathway topics managed separately from children&apos;s steps of progression.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-1">
                      <Link
                        href="/teacher/lessons"
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Lesson Plans & Media
                      </Link>
                    </div>

                    {!centerId ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        Select a center to preview the active teacher training pathway.
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
                              Effective {new Date(p.effectiveDate || p.createdAt).toLocaleDateString()} •{" "}
                              {(p.topics || []).length} topics
                            </div>
                            {p.description ? (
                              <div className="mt-2 text-xs text-gray-600">{p.description}</div>
                            ) : null}
                            {(p.topics || []).length ? (
                              <div className="mt-3 space-y-2">
                                {(p.topics || []).slice(0, 4).map((topic) => (
                                  <div key={topic.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                    <div className="text-xs font-extrabold text-gray-900">{topic.title}</div>
                                    <div className="mt-1 text-[11px] text-gray-600">
                                      {topic.durationHours ? `${topic.durationHours}h` : "No hours set"} •{" "}
                                      {topic.required ? "Required" : "Optional"}
                                    </div>
                                    {topic.description ? (
                                      <div className="mt-1 text-[11px] text-gray-500">{topic.description}</div>
                                    ) : null}
                                  </div>
                                ))}
                                {(p.topics || []).length > 4 ? (
                                  <div className="text-[11px] font-semibold text-gray-500">
                                    +{(p.topics || []).length - 4} more topics
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        No active teacher training pathways have been set up for this center.
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

          {tab === "evaluations" && (
            <EvaluationsPanel
              evaluations={visibleEvaluations}
              loading={loadingEvaluations}
              acknowledgingId={acknowledgingId}
              onAcknowledge={handleAcknowledgeEvaluation}
            />
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
    pillClass: "border-blue-200 bg-blue-50",
    pillText: "text-blue-900",
    iconBg: "bg-blue-100",
    iconText: "text-blue-800",
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

function EvaluationsPanel({ evaluations, loading, acknowledgingId, onAcknowledge }) {
  const submittedCount = evaluations.filter((evaluation) => evaluation.status === "SUBMITTED").length;
  const acknowledgedCount = evaluations.filter((evaluation) => evaluation.status === "ACKNOWLEDGED").length;
  const scoredEvaluations = evaluations.filter((evaluation) => Number.isFinite(evaluation.overallScore));
  const averageScore = scoredEvaluations.length
    ? Math.round((scoredEvaluations.reduce((sum, evaluation) => sum + evaluation.overallScore, 0) / scoredEvaluations.length) * 10) / 10
    : null;

  if (loading) return <div className="mt-4"><Skeleton count={4} /></div>;

  return (
    <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Submitted Evaluations
        </div>
        <p className="mt-1 text-sm text-blue-900">
          Submitted evaluations appear here after an administrator sends them. Review the details, then acknowledge the evaluation once you have read it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Visible Evaluations" value={evaluations.length} />
        <Metric label="Awaiting Acknowledgement" value={submittedCount} />
        <Metric label="Acknowledged" value={acknowledgedCount} />
        <Metric label="Average Score" value={averageScore ?? "-"} />
      </div>

      {!evaluations.length ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No submitted evaluations are available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((evaluation) => {
            const canAcknowledge = evaluation.status === "SUBMITTED";
            return (
              <div key={evaluation.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-extrabold text-gray-900">{evaluation.period || "Evaluation"}</div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        evaluation.status === "ACKNOWLEDGED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {formatEvaluationStatus(evaluation.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      By {evaluation.evaluator?.name || "Administrator"} • Created {formatDateLabel(evaluation.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`rounded-xl px-3 py-2 text-sm font-extrabold ${
                      evaluation.overallScore >= 80
                        ? "bg-emerald-50 text-emerald-700"
                        : evaluation.overallScore >= 60
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}>
                      {Number.isFinite(evaluation.overallScore) ? `${evaluation.overallScore}%` : "No score"}
                    </div>
                    {canAcknowledge ? (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(evaluation.id)}
                        disabled={acknowledgingId === evaluation.id}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acknowledgingId === evaluation.id ? "Acknowledging..." : "Acknowledge"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {evaluation.categories && Object.keys(evaluation.categories).length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                    {Object.entries(evaluation.categories).map(([category, score]) => (
                      <div key={category} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{category}</div>
                        <div className="mt-1 text-xl font-extrabold text-gray-800">
                          {score}
                          <span className="text-sm text-gray-400">/5</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {evaluation.strengths ? (
                    <DetailCard label="Strengths" value={evaluation.strengths} />
                  ) : null}
                  {evaluation.areasForImprovement ? (
                    <DetailCard label="Areas for Improvement" value={evaluation.areasForImprovement} />
                  ) : null}
                  {evaluation.goals ? (
                    <DetailCard label="Goals" value={evaluation.goals} />
                  ) : null}
                  {evaluation.notes ? (
                    <DetailCard label="Notes" value={evaluation.notes} />
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Score: {Number.isFinite(evaluation.overallScore) ? `${evaluation.overallScore}%` : "Not scored"}</span>
                  <span>Status: {formatEvaluationStatus(evaluation.status)}</span>
                  <span>Acknowledged: {evaluation.teacherAcknowledgedAt ? formatDateLabel(evaluation.teacherAcknowledgedAt) : "Pending"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function DetailCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{value}</p>
    </div>
  );
}
