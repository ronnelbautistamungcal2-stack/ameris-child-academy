import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";


/**
 * Professional Development: the training pathway the employee is working
 * through, plus the career-ladder records an administrator has recorded.
 * Shared by the Teacher and Other Staff portals.
 */
export default function ProfessionalDevelopment({ centerId, onError }) {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [togglingTopicId, setTogglingTopicId] = useState("");
  const [error, setError] = useState("");

  const reportError = useCallback(
    (message) => {
      setError(message);
      if (typeof onError === "function") onError(message);
    },
    [onError],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRecords(true);
      try {
        const data = await apiJson("/api/v1/teacher-records");
        if (!cancelled) setRecords(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) reportError(e.message || "Failed to load career records");
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  useEffect(() => {
    if (!centerId) {
      setPlans([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      try {
        const data = await apiJson(
          `/api/v1/teacher-training-pathways?centerId=${encodeURIComponent(centerId)}`,
        );
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) reportError(e.message || "Failed to load training pathway");
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, reportError]);

  const handleToggleTopic = useCallback(
    async (topicId, completed) => {
      setTogglingTopicId(topicId);
      setError("");
      try {
        await apiJson(`/api/v1/teacher-training-pathways/topics/${topicId}/complete`, {
          method: completed ? "DELETE" : "POST",
        });
        setPlans((prev) =>
          prev.map((p) => ({
            ...p,
            topics: (p.topics || []).map((t) =>
              t.id === topicId
                ? { ...t, completedAt: completed ? null : new Date().toISOString() }
                : t,
            ),
          })),
        );
      } catch (e) {
        reportError(e.message || "Failed to update training progress");
      } finally {
        setTogglingTopicId("");
      }
    },
    [reportError],
  );

  return (
    <>
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <ProfessionalDevelopmentPanel
        plans={plans}
        loadingPlans={loadingPlans}
        centerId={centerId}
        togglingTopicId={togglingTopicId}
        onToggleTopic={handleToggleTopic}
        records={records}
        loadingRecords={loadingRecords}
      />
    </>
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

function buildPathwayTrack(plans) {
  const sorted = (plans || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.effectiveDate || a.createdAt).getTime() -
        new Date(b.effectiveDate || b.createdAt).getTime(),
    );

  const withProgress = sorted.map((pathway) => {
    const topics = pathway.topics || [];
    const trackable = topics.some((t) => t.required) ? topics.filter((t) => t.required) : topics;
    const completed = trackable.filter((t) => t.completedAt).length;
    const percent = trackable.length ? Math.round((completed / trackable.length) * 100) : 0;
    return { pathway, completed, total: trackable.length, percent };
  });

  const currentIndex = withProgress.findIndex((entry) => entry.percent < 100);
  const resolvedCurrentIndex = currentIndex === -1 ? withProgress.length - 1 : currentIndex;

  return withProgress.map((entry, index) => ({
    ...entry,
    status:
      index < resolvedCurrentIndex ? "completed" : index === resolvedCurrentIndex ? "current" : "upcoming",
  }));
}

function ProfessionalDevelopmentPanel({
  plans,
  loadingPlans,
  centerId,
  togglingTopicId,
  onToggleTopic,
  records,
  loadingRecords,
}) {
  const track = useMemo(() => buildPathwayTrack(plans), [plans]);

  return (
    <div className="mt-5 space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Training Pathway
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Your professional development track, in order. Check off topics as you complete them to
          track your progress toward the next pathway.
        </p>

        {!centerId ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            Select a center to view your training pathway.
          </div>
        ) : loadingPlans ? (
          <div className="mt-3"><Skeleton count={4} /></div>
        ) : !track.length ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No active teacher training pathways have been set up for this center.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {track.map((entry) => (
              <PathwayStage
                key={entry.pathway.id}
                entry={entry}
                togglingTopicId={togglingTopicId}
                onToggleTopic={onToggleTopic}
              />
            ))}
          </div>
        )}
      </div>

      <CareerLadderPanel records={records} loading={loadingRecords} />
    </div>
  );
}

function PathwayStage({ entry, togglingTopicId, onToggleTopic }) {
  const { pathway, percent, completed, total, status } = entry;
  const isCurrent = status === "current";
  const isUpcoming = status === "upcoming";
  const topics = pathway.topics || [];

  return (
    <div
      className={[
        "rounded-xl border p-4",
        isCurrent
          ? "border-blue-300 bg-blue-50/40"
          : isUpcoming
            ? "border-gray-200 bg-gray-50"
            : "border-emerald-200 bg-emerald-50/40",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                isCurrent
                  ? "bg-blue-600 text-white"
                  : isUpcoming
                    ? "bg-gray-200 text-gray-600"
                    : "bg-emerald-600 text-white",
              ].join(" ")}
            >
              {isCurrent ? "In Progress" : isUpcoming ? "Up Next" : "Completed"}
            </span>
            <div className="text-sm font-extrabold text-gray-900">{pathway.title}</div>
          </div>
          {pathway.description ? (
            <p className="mt-1 text-xs text-gray-600">{pathway.description}</p>
          ) : null}
          <div className="mt-1 text-[11px] text-gray-500">
            Effective {new Date(pathway.effectiveDate || pathway.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-extrabold text-gray-900">{percent}%</div>
          <div className="text-[11px] text-gray-500">
            {completed}/{total} topics
          </div>
        </div>
      </div>

      {total ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={["h-full rounded-full", isUpcoming ? "bg-gray-300" : "bg-blue-600"].join(" ")}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {topics.length ? (
        <div className="mt-3 space-y-2">
          {topics.map((topic) =>
            isUpcoming ? (
              <div
                key={topic.id}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 opacity-70"
              >
                <div className="text-xs font-extrabold text-gray-700">{topic.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {topic.durationHours ? `${topic.durationHours}h` : "No hours set"} •{" "}
                  {topic.required ? "Required" : "Optional"}
                </div>
              </div>
            ) : (
              <label
                key={topic.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={!!topic.completedAt}
                  disabled={togglingTopicId === topic.id}
                  onChange={() => onToggleTopic(topic.id, !!topic.completedAt)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div
                    className={[
                      "text-xs font-extrabold",
                      topic.completedAt ? "text-gray-500 line-through" : "text-gray-900",
                    ].join(" ")}
                  >
                    {topic.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {topic.durationHours ? `${topic.durationHours}h` : "No hours set"} •{" "}
                    {topic.required ? "Required" : "Optional"}
                  </div>
                  {topic.description ? (
                    <div className="mt-1 text-[11px] text-gray-500">{topic.description}</div>
                  ) : null}
                </div>
              </label>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

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
