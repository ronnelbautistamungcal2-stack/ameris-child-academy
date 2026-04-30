import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton from "@/components/ui/Skeleton";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceSection,
  WorkspaceState,
  WorkspaceStat,
  workspaceInputClass,
  workspaceSecondaryButtonClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORY_LABELS = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HEALTH_SAFETY: "Health & Safety",
  CLEANING: "Cleaning",
  MEALS: "Meals",
  OTHER: "Other",
};

const CATEGORY_BORDER = {
  OPENING: "border-l-amber-400",
  CLOSING: "border-l-indigo-400",
  HEALTH_SAFETY: "border-l-rose-400",
  CLEANING: "border-l-emerald-400",
  MEALS: "border-l-orange-400",
  OTHER: "border-l-gray-400",
};

const FREQUENCY_BADGE = {
  DAILY: "bg-sky-50 text-sky-700",
  WEEKLY: "bg-violet-50 text-violet-700",
  MONTHLY: "bg-amber-50 text-amber-700",
};

function todayString() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const left = a.taskTime || "99:99";
    const right = b.taskTime || "99:99";
    if (left !== right) return left.localeCompare(right);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

export default function StaffChecklistsPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [checklists, setChecklists] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [completingId, setCompletingId] = useState("");
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoadingCenters(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load centers");
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  const loadChecklists = useCallback(async () => {
    if (!centerId) {
      setChecklists([]);
      return;
    }

    setLoadingChecklists(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}&date=${encodeURIComponent(selectedDate)}`,
      );
      const filtered = (Array.isArray(data) ? data : []).filter(
        (checklist) => !checklist?.classRoomId && checklist?.category !== "CLASSROOM",
      );
      setChecklists(filtered);
    } catch (nextError) {
      setError(nextError.message || "Failed to load daily checklists");
    } finally {
      setLoadingChecklists(false);
    }
  }, [centerId, selectedDate]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  async function toggleItem(itemId, isCompleted) {
    setCompletingId(itemId);
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists/complete", {
        method: "POST",
        body: JSON.stringify({
          itemId,
          date: selectedDate,
          undo: isCompleted,
        }),
      });
      await loadChecklists();
    } catch (nextError) {
      setError(nextError.message || "Failed to update checklist item");
    } finally {
      setCompletingId("");
    }
  }

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";

  const totals = useMemo(() => {
    const totalItems = checklists.reduce(
      (sum, checklist) => sum + (checklist.items?.length || 0),
      0,
    );
    const completedItems = checklists.reduce(
      (sum, checklist) =>
        sum +
        (checklist.items || []).filter(
          (item) => Array.isArray(item.completions) && item.completions.length > 0,
        ).length,
      0,
    );
    const percent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
    return {
      checklistCount: checklists.length,
      totalItems,
      completedItems,
      openItems: Math.max(totalItems - completedItems, 0),
      percent,
    };
  }, [checklists]);

  return (
    <StaffLayout
      title="Checklists"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1320px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Operations Checklists"
          title={
            selectedCenterName
              ? `${selectedCenterName} daily operations`
              : "Daily operations checklists"
          }
          description="Track center-wide opening, safety, cleaning, meals, and closing tasks without classroom-only checklist noise."
          meta={
            <>
              <WorkspacePill tone="amber">{selectedDate}</WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : (
                <WorkspacePill tone="slate">Select a center to begin</WorkspacePill>
              )}
            </>
          }
          controls={
            <div className="space-y-3">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={workspaceInputClass}
                  disabled={loadingCenters}
                >
                  <option value="">Select a center...</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                  Checklist Date
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className={workspaceInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayString())}
                    className={[workspaceSecondaryButtonClass, "shrink-0 px-4"].join(" ")}
                  >
                    Today
                  </button>
                </div>
              </label>
            </div>
          }
          stats={
            <>
              <WorkspaceStat
                label="Visible Lists"
                value={totals.checklistCount}
                description="Operations checklists assigned to this center."
                tone="sky"
              />
              <WorkspaceStat
                label="Open Items"
                value={totals.openItems}
                description="Tasks still waiting to be completed."
                tone="amber"
              />
              <WorkspaceStat
                label="Completed"
                value={totals.completedItems}
                description="Tasks already checked off for the selected date."
                tone="emerald"
              />
              <WorkspaceStat
                label="Progress"
                value={`${totals.percent}%`}
                description="Completion rate across visible operations tasks."
                tone="slate"
              />
            </>
          }
        />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loadingCenters ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <Skeleton count={5} />
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to load daily operations."
            description="Other staff only see center-wide checklist items here. Classroom-specific lists stay out of this portal."
          />
        ) : (
          <>
            <WorkspaceSection
              title="Progress"
              description="Completion status for the selected day."
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="font-semibold text-gray-700">
                  {totals.completedItems} of {totals.totalItems} tasks completed
                </div>
                <div className="font-extrabold text-gray-900">{totals.percent}%</div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    totals.percent === 100 ? "bg-emerald-500" : "bg-sky-500"
                  }`}
                  style={{ width: `${totals.percent}%` }}
                />
              </div>
            </WorkspaceSection>

            {loadingChecklists ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <Skeleton count={6} />
              </div>
            ) : !checklists.length ? (
              <WorkspaceState
                title="No operations checklists are assigned to this center."
                description="An administrator can publish center-wide opening, safety, cleaning, and closing lists here."
              />
            ) : (
              <div className="space-y-4">
                {checklists.map((checklist) => {
                  const items = sortByTaskTime(checklist.items);
                  const doneCount = items.filter(
                    (item) => Array.isArray(item.completions) && item.completions.length > 0,
                  ).length;
                  const allDone = items.length > 0 && doneCount === items.length;

                  return (
                    <WorkspaceSection
                      key={checklist.id}
                      title={checklist.title}
                      description={checklist.description || "Center-wide operations checklist"}
                      className={[
                        "border-l-4",
                        CATEGORY_BORDER[checklist.category] || "border-l-gray-400",
                        allDone ? "opacity-80" : "",
                      ].join(" ")}
                      action={
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                            {CATEGORY_LABELS[checklist.category] || checklist.category}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              FREQUENCY_BADGE[checklist.frequency] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {checklist.frequency}
                          </span>
                          {allDone ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Complete
                            </span>
                          ) : null}
                        </div>
                      }
                    >
                      {!items.length ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                          This checklist does not have any items yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {items.map((item) => {
                            const completion = Array.isArray(item.completions)
                              ? item.completions[0]
                              : null;
                            const isDone = !!completion;
                            const busy = completingId === item.id;

                            return (
                              <div
                                key={item.id}
                                className={[
                                  "flex items-start gap-3 rounded-2xl border px-4 py-3 transition",
                                  isDone
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : "border-gray-200 bg-white",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleItem(item.id, isDone)}
                                  disabled={busy}
                                  className={[
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition",
                                    isDone
                                      ? "border-emerald-500 bg-emerald-500 text-white"
                                      : "border-gray-300 bg-white hover:border-sky-400",
                                    busy ? "animate-pulse" : "",
                                  ].join(" ")}
                                >
                                  {isDone ? (
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  ) : null}
                                </button>
                                <div className="min-w-0 flex-1">
                                  {item.taskTime ? (
                                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-600">
                                      {formatTaskTime(item.taskTime)}
                                    </div>
                                  ) : null}
                                  <div
                                    className={[
                                      "text-sm font-semibold",
                                      isDone ? "text-gray-500 line-through" : "text-gray-900",
                                    ].join(" ")}
                                  >
                                    {item.title}
                                  </div>
                                  {item.description ? (
                                    <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.policyLink ? (
                                      <a
                                        href={item.policyLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                                      >
                                        Policy
                                      </a>
                                    ) : null}
                                    {item.mediaLink ? (
                                      <a
                                        href={item.mediaLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                                      >
                                        Training Video
                                      </a>
                                    ) : null}
                                  </div>
                                  {completion ? (
                                    <div className="mt-2 text-[11px] text-emerald-700">
                                      Completed by{" "}
                                      {completion.completedBy?.name ||
                                        completion.completedBy?.email ||
                                        "Staff"}{" "}
                                      at{" "}
                                      {new Date(completion.completedAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </WorkspaceSection>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </StaffLayout>
  );
}
