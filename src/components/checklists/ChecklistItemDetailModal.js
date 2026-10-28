import { checklistItemHref } from "@/lib/checklistLinks";
import { collectChecklistLessonAttachments } from "@/lib/checklistLessonResources";
import { describeChecklistSchedule, getEffectiveItemSchedule } from "@/lib/checklistSchedule";
import { formatTaskTime } from "@/lib/checklistTime";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ChecklistItemDetailModal({ detail, onClose }) {
  if (!detail?.item || !detail?.checklist) return null;

  const { checklist, item, completion } = detail;
  const lesson = item.lesson || null;
  const policy = item.policyDocument || null;
  const goalCount = Array.isArray(lesson?.goals) ? lesson.goals.length : 0;
  const lessonAttachments = collectChecklistLessonAttachments(
    lesson,
    item.lessonGoal,
  );
  const itemSchedule = getEffectiveItemSchedule(item, checklist);
  const detailScheduleLabel =
    item.source === "SCHEDULED_LESSON"
      ? checklist.scheduleLabel || "Scheduled today"
      : describeChecklistSchedule(itemSchedule);
  const hasLinkedResources =
    lessonAttachments.length > 0 ||
    !!policy?.url ||
    !!item.directLink ||
    !!item.policyLink ||
    !!item.mediaLink;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {checklist.title}
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-gray-900">
              {item.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span>{detailScheduleLabel}</span>
              {item.taskTime ? <span>{formatTaskTime(item.taskTime)}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {item.description ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Item Details
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.description}</p>
            </div>
          ) : null}

          {completion ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Completed by{" "}
              <span className="font-semibold">
                {completion.completedBy?.name ||
                  completion.completedBy?.email ||
                  "Staff"}
              </span>{" "}
              at {formatDateTime(completion.completedAt)}.
            </div>
          ) : null}

          {lesson ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Linked Lesson
              </div>
              <div className="mt-2 text-base font-bold text-gray-900">
                {lesson.title}
              </div>
              {lesson.category?.name || lesson.term || lesson.reference ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                  {lesson.category?.name ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {lesson.category.name}
                    </span>
                  ) : null}
                  {lesson.term ? <span>Term: {lesson.term}</span> : null}
                  {lesson.reference ? (
                    <span>Reference: {lesson.reference}</span>
                  ) : null}
                </div>
              ) : null}
              {lesson.description ? (
                <p className="mt-3 text-sm text-gray-700">{lesson.description}</p>
              ) : null}
              {goalCount ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-600">
                    Progression steps
                  </div>
                  <div className="mt-2 grid gap-2">
                    {lesson.goals.map((goal) => (
                      <div
                        key={goal.id || `${lesson.id}:${goal.goalIndex}`}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          Step {goal.goalIndex}: {goal.title}
                        </div>
                        {goal.description ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {goal.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : item.lessonSource === "AUTO_SLOT" && item.lessonSlot ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Auto Lesson Slot
              </div>
              <div className="mt-2 text-sm font-semibold text-indigo-900">
                {item.lessonSlot}
              </div>
              <p className="mt-1 text-xs text-indigo-800">
                No lesson matched this slot for the current term day yet.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Linked Resources
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {lessonAttachments.map((attachment) => (
                <a
                  key={attachment.href}
                  href={attachment.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open attachment: {attachment.label}
                </a>
              ))}
              {policy?.url ? (
                <a
                  href={policy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open Policy: {policy.title || "Policy"}
                </a>
              ) : null}
              {item.directLink ? (
                <a
                  href={checklistItemHref(item)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {item.directLinkLabel || "Open linked resource"}
                </a>
              ) : null}
              {item.policyLink ? (
                <a
                  href={item.policyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open reference link
                </a>
              ) : null}
              {item.mediaLink ? (
                <a
                  href={item.mediaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open training video
                </a>
              ) : null}
              {!hasLinkedResources ? (
                <div className="text-sm text-gray-500">
                  No linked files, policy links, or reference material has been
                  added to this item yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

