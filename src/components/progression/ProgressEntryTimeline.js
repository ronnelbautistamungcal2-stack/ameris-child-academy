import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

const ROLE_BADGE = {
  ADMIN: "bg-blue-100 text-blue-700",
  COACH: "bg-violet-100 text-violet-700",
  TEACHER: "bg-sky-100 text-sky-700",
  PARENT: "bg-emerald-100 text-emerald-700",
};

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

function isVideoUrl(url) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export default function ProgressEntryTimeline({ progressId, entries: propEntries }) {
  const [entries, setEntries] = useState(propEntries || []);
  const [loading, setLoading] = useState(!propEntries);

  useEffect(() => {
    if (propEntries) {
      setEntries(propEntries);
      return;
    }

    if (!progressId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await apiJson(
          `/api/v1/progress/${encodeURIComponent(progressId)}/entries`,
        );
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [progressId, propEntries]);

  if (loading) {
    return <div className="py-4 text-center text-xs text-gray-500">Loading timeline...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-gray-500">
        No entries recorded yet.
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />

      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-3 py-2.5 pl-2">
          {/* Dot */}
          <div
            className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-white ${
              entry.status === "FAILED"
                ? "bg-red-400"
                : entry.status === "PASSED" || entry.status === "COMPLETED"
                  ? "bg-emerald-400"
                  : entry.status === "IN_PROGRESS"
                    ? "bg-amber-400"
                    : "bg-gray-300"
            }`}
          />

          {/* Content */}
          <div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {entry.recordedBy?.name || "Unknown"}
                </span>
                {entry.recordedBy?.role && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      ROLE_BADGE[entry.recordedBy.role] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {entry.recordedBy.role}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-gray-400">
                {formatDateTime(entry.occurredAt)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  STATUS_BADGE[entry.status] || STATUS_BADGE.NOT_STARTED
                }`}
              >
                {STATUS_LABEL[entry.status] || entry.status}
              </span>
            </div>

            {entry.notes && (
              <p className="mt-1.5 text-sm text-gray-700">{entry.notes}</p>
            )}

            {entry.media?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.media.map((url, i) =>
                  isImageUrl(url) ? (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Attachment ${i + 1}`}
                        className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                      />
                    </a>
                  ) : isVideoUrl(url) ? (
                    <video
                      key={i}
                      src={url}
                      className="h-16 w-24 rounded-lg border border-gray-200 object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-16 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs text-blue-600 hover:bg-gray-50"
                    >
                      Attachment {i + 1}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
