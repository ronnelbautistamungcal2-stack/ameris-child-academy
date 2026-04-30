import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceSection,
  WorkspaceState,
  WorkspaceStat,
  workspaceInputClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const TRAINING_CATEGORIES = [
  "Orientation",
  "Safety",
  "Curriculum",
  "Professional Development",
  "Other",
];

function formatDateLabel(value, options) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, options || {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEvaluationStatus(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StaffTrainingPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [evaluations, setEvaluations] = useState([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers, {
    blankQueryValue: "all",
  });

  useEffect(() => {
    (async () => {
      setLoadingBase(true);
      setError("");
      try {
        const [centerRows, metricRows] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/metrics/me").catch(() => null),
        ]);
        setCenters(Array.isArray(centerRows) ? centerRows : []);
        setMetrics(metricRows);
      } catch (nextError) {
        setError(nextError.message || "Failed to load performance data");
      } finally {
        setLoadingBase(false);
      }
    })();
  }, []);

  const loadEvaluations = useCallback(async () => {
    setLoadingEvaluations(true);
    setError("");
    try {
      const query = centerId
        ? `?centerId=${encodeURIComponent(centerId)}`
        : "";
      const data = await apiJson(`/api/v1/evaluations${query}`);
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load evaluations");
    } finally {
      setLoadingEvaluations(false);
    }
  }, [centerId]);

  useEffect(() => {
    if (tab !== "evaluations") return;
    loadEvaluations();
  }, [loadEvaluations, tab]);

  const visibleEvaluations = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status !== "DRAFT"),
    [evaluations],
  );

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";

  async function handleAcknowledgeEvaluation(evaluationId) {
    setAcknowledgingId(evaluationId);
    setError("");
    try {
      await apiJson(`/api/v1/evaluations/${evaluationId}/acknowledge`, {
        method: "POST",
      });
      await loadEvaluations();
      const refreshedMetrics = await apiJson("/api/v1/metrics/me").catch(() => null);
      if (refreshedMetrics) setMetrics(refreshedMetrics);
    } catch (nextError) {
      setError(nextError.message || "Failed to acknowledge evaluation");
    } finally {
      setAcknowledgingId("");
    }
  }

  return (
    <StaffLayout
      title="Performance & Training"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1320px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Performance & Training"
          title={
            selectedCenterName
              ? `${selectedCenterName} staff performance view`
              : "My performance and training"
          }
          description="Review your activity, attendance, evaluations, and training hours without any classroom or child progress modules."
          meta={
            <>
              <WorkspacePill tone="amber">
                {centerId ? "Center filtered" : "All accessible centers"}
              </WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : null}
            </>
          }
          controls={
            <label className="block">
              <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Center Filter
              </div>
              <select
                value={centerId || "all"}
                onChange={(event) =>
                  setCenterId(event.target.value === "all" ? "" : event.target.value)
                }
                className={workspaceInputClass}
                disabled={loadingBase}
              >
                <option value="all">All accessible centers</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          }
          stats={
            <>
              <WorkspaceStat
                label="Training Hours"
                value={metrics?.training?.totalHours ?? 0}
                description="Hours recorded in your training log."
                tone="emerald"
              />
              <WorkspaceStat
                label="Evaluations"
                value={metrics?.evaluations?.count ?? 0}
                description="Evaluations in your performance history."
                tone="sky"
              />
              <WorkspaceStat
                label="Activities This Week"
                value={metrics?.activities?.week ?? 0}
                description="Recent staff activity entries associated with you."
                tone="amber"
              />
              <WorkspaceStat
                label="Late Minutes"
                value={metrics?.attendance?.totalLateMinutes ?? 0}
                description="Late minutes recorded in your recent attendance."
                tone="slate"
              />
            </>
          }
        />

        <div className="flex flex-wrap gap-2">
          {[
            { key: "overview", label: "Overview" },
            { key: "evaluations", label: "Evaluations" },
            { key: "training-hours", label: "Training Hours" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-bold transition",
                tab === item.key
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loadingBase ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : tab === "overview" ? (
          <OverviewPanel metrics={metrics} />
        ) : tab === "evaluations" ? (
          <EvaluationsPanel
            evaluations={visibleEvaluations}
            loading={loadingEvaluations}
            acknowledgingId={acknowledgingId}
            onAcknowledge={handleAcknowledgeEvaluation}
          />
        ) : (
          <TrainingHoursPanel centerId={centerId} />
        )}
      </div>
    </StaffLayout>
  );
}

function OverviewPanel({ metrics }) {
  if (!metrics) {
    return (
      <WorkspaceState
        title="Performance metrics are not available right now."
        description="Training logs and evaluations still work, but the summary cards could not be loaded from the metrics endpoint."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <WorkspaceSection
          title="Activity Snapshot"
          description="Recent work volume and attendance history tied to your account."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Today" value={metrics.activities?.today ?? 0} />
            <MiniMetric label="This Week" value={metrics.activities?.week ?? 0} />
            <MiniMetric label="Last 30 Days" value={metrics.activities?.last30Days ?? 0} />
            <MiniMetric label="Active Days" value={metrics.activities?.activeDaysLast30 ?? 0} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Present" value={metrics.attendance?.present ?? 0} />
            <MiniMetric label="Late" value={metrics.attendance?.late ?? 0} />
            <MiniMetric label="Absent" value={metrics.attendance?.absent ?? 0} />
            <MiniMetric label="Half Day" value={metrics.attendance?.halfDay ?? 0} />
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          title="Training Totals"
          description="Hours and categories currently recorded in your training log."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Total Hours" value={metrics.training?.totalHours ?? 0} />
            <MiniMetric label="Entries" value={metrics.training?.entries ?? 0} />
            <MiniMetric
              label="Last Completed"
              value={formatDateLabel(metrics.training?.lastCompletedAt)}
            />
            <MiniMetric
              label="Average / Active Day"
              value={metrics.activities?.averagePerActiveDay ?? 0}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(metrics.training?.byCategory || {}).length ? (
              Object.entries(metrics.training.byCategory).map(([category, hours]) => (
                <span
                  key={category}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                >
                  {category}: {hours}h
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No category totals are available yet.</span>
            )}
          </div>
        </WorkspaceSection>
      </div>

      <div className="space-y-4">
        <WorkspaceSection
          title="Latest Evaluation"
          description="Your most recent evaluation status and score."
        >
          {metrics.evaluations?.latest ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
              <div className="text-base font-extrabold text-gray-900">
                {metrics.evaluations.latest.period || "Evaluation"}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {formatEvaluationStatus(metrics.evaluations.latest.status)}
                {Number.isFinite(metrics.evaluations.latest.overallScore)
                  ? ` | ${metrics.evaluations.latest.overallScore}%`
                  : ""}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Created {formatDateLabel(metrics.evaluations.latest.createdAt)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Acknowledged:{" "}
                {metrics.evaluations.latest.teacherAcknowledgedAt
                  ? formatDateLabel(metrics.evaluations.latest.teacherAcknowledgedAt)
                  : "Pending"}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No evaluations are available yet.
            </div>
          )}
        </WorkspaceSection>

        <WorkspaceSection
          title="Recent Training"
          description="The latest training records tied to your profile."
        >
          {metrics.training?.recent?.length ? (
            <div className="space-y-3">
              {metrics.training.recent.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="text-sm font-extrabold text-gray-900">{entry.topic}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {entry.category || "Other"} | {entry.hours}h
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatDateLabel(entry.date)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No recent training entries are available yet.
            </div>
          )}
        </WorkspaceSection>
      </div>
    </div>
  );
}

function EvaluationsPanel({ evaluations, loading, acknowledgingId, onAcknowledge }) {
  const submittedCount = evaluations.filter((evaluation) => evaluation.status === "SUBMITTED").length;
  const acknowledgedCount = evaluations.filter((evaluation) => evaluation.status === "ACKNOWLEDGED").length;
  const scoredEvaluations = evaluations.filter((evaluation) => Number.isFinite(evaluation.overallScore));
  const averageScore = scoredEvaluations.length
    ? Math.round(
        (scoredEvaluations.reduce((sum, evaluation) => sum + evaluation.overallScore, 0) /
          scoredEvaluations.length) *
          10,
      ) / 10
    : null;

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6">
        <Skeleton count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkspaceSection
        title="Submitted Evaluations"
        description="Administrators publish evaluations here for review and acknowledgement."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniMetric label="Visible" value={evaluations.length} />
          <MiniMetric label="Awaiting Ack" value={submittedCount} />
          <MiniMetric label="Acknowledged" value={acknowledgedCount} />
          <MiniMetric label="Average Score" value={averageScore ?? "-"} />
        </div>
      </WorkspaceSection>

      {!evaluations.length ? (
        <WorkspaceState
          title="No submitted evaluations are available yet."
          description="Evaluations appear here after an administrator submits them from Staff Management."
        />
      ) : (
        <div className="space-y-4">
          {evaluations.map((evaluation) => {
            const canAcknowledge = evaluation.status === "SUBMITTED";
            const scoreTone = Number.isFinite(evaluation.overallScore)
              ? evaluation.overallScore >= 80
                ? "bg-emerald-50 text-emerald-700"
                : evaluation.overallScore >= 60
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700"
              : "bg-gray-50 text-gray-600";

            return (
              <WorkspaceSection
                key={evaluation.id}
                title={evaluation.period || "Evaluation"}
                description={`Created ${formatDateLabel(evaluation.createdAt)} by ${
                  evaluation.evaluator?.name || "Administrator"
                }`}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreTone}`}>
                      {Number.isFinite(evaluation.overallScore)
                        ? `${evaluation.overallScore}%`
                        : "No score"}
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      {formatEvaluationStatus(evaluation.status)}
                    </span>
                    {canAcknowledge ? (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(evaluation.id)}
                        disabled={acknowledgingId === evaluation.id}
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {acknowledgingId === evaluation.id ? "Acknowledging..." : "Acknowledge"}
                      </button>
                    ) : null}
                  </div>
                }
              >
                {evaluation.categories && Object.keys(evaluation.categories).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {Object.entries(evaluation.categories).map(([category, score]) => (
                      <div
                        key={category}
                        className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 text-center"
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                          {category}
                        </div>
                        <div className="mt-2 text-xl font-black text-gray-900">
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
                    <DetailCard
                      label="Areas for Improvement"
                      value={evaluation.areasForImprovement}
                    />
                  ) : null}
                  {evaluation.goals ? <DetailCard label="Goals" value={evaluation.goals} /> : null}
                  {evaluation.notes ? <DetailCard label="Notes" value={evaluation.notes} /> : null}
                </div>
              </WorkspaceSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrainingHoursPanel({ centerId }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    topic: "",
    description: "",
    hours: "",
    date: new Date().toISOString().split("T")[0],
    category: "Other",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = centerId ? `centerId=${encodeURIComponent(centerId)}` : "";
      const [logsData, summaryData] = await Promise.all([
        apiJson(`/api/v1/training-logs?${query}`),
        apiJson(`/api/v1/training-logs/summary?${query}`),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData);
    } catch (nextError) {
      setError(nextError.message || "Failed to load training logs");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave(event) {
    event.preventDefault();
    if (!centerId) {
      setError("Select a center before logging training hours.");
      return;
    }
    if (!form.topic || !form.hours) return;

    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          topic: form.topic,
          description: form.description || null,
          hours: parseFloat(form.hours),
          date: form.date,
          category: form.category,
        }),
      });
      setShowForm(false);
      setForm({
        topic: "",
        description: "",
        hours: "",
        date: new Date().toISOString().split("T")[0],
        category: "Other",
      });
      await loadData();
    } catch (nextError) {
      setError(nextError.message || "Failed to save training log");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <WorkspaceSection
          title="Training Summary"
          description="Your recorded training totals across the selected scope."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Total Hours" value={summary.totalHours || 0} />
            <MiniMetric label="Entries" value={summary.totalEntries || 0} />
            {Object.entries(summary.byCategory || {})
              .slice(0, 2)
              .map(([category, hours]) => (
                <MiniMetric key={category} label={category} value={hours} />
              ))}
          </div>
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection
        title="My Training Log"
        description="Record completed training sessions and keep your running hours up to date."
        action={
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
          >
            {showForm ? "Close Form" : "Log Training"}
          </button>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!centerId ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Select a center above if you want to add a new training entry. Existing entries can still be reviewed across all accessible centers.
          </div>
        ) : null}

        {showForm ? (
          <form
            onSubmit={handleSave}
            className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-4 md:grid-cols-2"
          >
            <label className="block">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Topic
              </div>
              <input
                type="text"
                value={form.topic}
                onChange={(event) => setForm({ ...form, topic: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Hours
              </div>
              <input
                type="number"
                step="0.5"
                value={form.hours}
                onChange={(event) => setForm({ ...form, hours: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Date
              </div>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Category
              </div>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {TRAINING_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Description
              </div>
              <input
                type="text"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Training Entry"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <div className="mt-4">
            <Skeleton count={4} />
          </div>
        ) : !logs.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No training hours have been logged yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-gray-900">{log.topic}</div>
                  <div className="text-xs text-gray-500">
                    {log.hours}h | {formatDateLabel(log.date)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {log.category || "Other"}
                  {log.description ? ` | ${log.description}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{value}</p>
    </div>
  );
}
