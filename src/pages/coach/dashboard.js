import Link from "next/link";
import { useEffect, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachActionCard,
  CoachBadge,
  CoachEmptyPanel,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
  coachPrimaryButtonClass,
  coachSecondaryButtonClass,
} from "@/components/coach/CoachPage";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";

export default function CoachDashboard() {
  const [data, setData] = useState(null);
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
        setLoading(false);
      } catch (err) {
        setError(err.message || "Failed to load centers");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiJson(
          `/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`,
        );
        setData(response);
      } catch (err) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const centerName = centers.find((center) => center.id === centerId)?.name || "";
  const teachers = data?.teachers || [];
  const checklistSummary = data?.checklistSummary || [];
  const overdueAlarms = data?.overdueAlarms || [];
  const followUpCounts = data?.followUpCounts || {};
  const recentObservations = data?.recentObservations || [];

  const openFollowUps =
    Number(followUpCounts.PARENT || 0) +
    Number(followUpCounts.CAMERA_OBSERVATION || 0) +
    Number(followUpCounts.GENERAL || 0);
  const criticalChecklistItems = checklistSummary.reduce(
    (count, plan) =>
      count +
      (plan.items || []).filter((item) => item.priority === "CRITICAL" || item.priority === "HIGH")
        .length,
    0,
  );

  const scoredObservations = recentObservations.filter((item) => item.score != null);
  const averageScore = scoredObservations.length
    ? (
        scoredObservations.reduce((sum, item) => sum + Number(item.score || 0), 0) /
        scoredObservations.length
      ).toFixed(1)
    : "-";

  return (
    <CoachLayout title="Coach Dashboard">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Coach Command"
          title="See where coaching attention is needed before issues pile up."
          description="Track teacher coverage, open follow-through, checklist drift, and recent observations from one focused workspace."
          meta={
            <>
              <CoachBadge tone="amber">{formatHeaderDate(new Date())}</CoachBadge>
              {centerName ? <CoachBadge tone="sky">{centerName}</CoachBadge> : null}
              {!centerId && centers.length > 1 ? (
                <CoachBadge tone="slate">Select a center to load live oversight data</CoachBadge>
              ) : null}
            </>
          }
          controls={
            centers.length > 0 ? (
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center View
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
                >
                  <option value="">Select a center to load data...</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          }
          actions={
            centerId ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Link
                  href={`/coach/observations?centerId=${centerId}`}
                  className={coachPrimaryButtonClass}
                >
                  New Observation
                </Link>
                <Link
                  href={`/coach/follow-ups?centerId=${centerId}`}
                  className={coachSecondaryButtonClass}
                >
                  Create Follow-up
                </Link>
              </div>
            ) : null
          }
          stats={
            centerId ? (
              loading ? (
                Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)
              ) : (
                <>
                  <CoachMetricCard
                    label="Teachers"
                    value={String(teachers.length)}
                    hint="Assigned to this center"
                    tone="sky"
                    href={`/coach/messages?centerId=${centerId}`}
                    icon={<TeamIcon />}
                  />
                  <CoachMetricCard
                    label="Open Follow-ups"
                    value={String(openFollowUps)}
                    hint="Parent, camera, and general"
                    tone="amber"
                    href={`/coach/follow-ups?centerId=${centerId}`}
                    icon={<ChecklistIcon />}
                  />
                  <CoachMetricCard
                    label="Overdue Alarms"
                    value={String(overdueAlarms.length)}
                    hint="Checklist items past due"
                    tone={overdueAlarms.length ? "rose" : "emerald"}
                    href={`/coach/checklists?centerId=${centerId}`}
                    icon={<AlertIcon />}
                  />
                  <CoachMetricCard
                    label="Recent Avg Score"
                    value={String(averageScore)}
                    hint={`${recentObservations.length} recent observations`}
                    tone="emerald"
                    href={`/coach/observations?centerId=${centerId}`}
                    icon={<SparkIcon />}
                  />
                </>
              )
            ) : null
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!centerId ? (
          <CoachEmptyPanel
            title="Choose a center to start your review."
            description="The coach dashboard is organized by center so observations, checklist risks, and follow-ups stay scoped to the right team."
          />
        ) : null}

        {centerId && loading ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <CoachPanel title="Teacher Coverage" description="Loading teacher assignments.">
                <SkeletonTable rows={5} cols={3} />
              </CoachPanel>
              <CoachPanel title="Checklist Plans" description="Loading active plans.">
                <SkeletonTable rows={4} cols={3} />
              </CoachPanel>
            </div>
            <div className="space-y-5">
              <CoachPanel title="Action Queue" description="Loading current risks.">
                <SkeletonTable rows={4} cols={1} />
              </CoachPanel>
            </div>
          </div>
        ) : null}

        {centerId && !loading && data ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="space-y-5">
              <CoachPanel
                title="Teacher Coverage"
                description="See who is assigned where and jump directly into coaching actions."
                action={
                  <Link
                    href={`/coach/messages?centerId=${centerId}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Message Teachers
                  </Link>
                }
              >
                {teachers.length === 0 ? (
                  <CoachEmptyPanel
                    title="No teachers assigned here yet."
                    description="Once teachers are assigned to this center, coaching actions and classroom coverage will appear here."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {teachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                            {initials(teacher.name || teacher.email)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                              {teacher.name || teacher.email}
                            </div>
                            <div className="break-words text-xs text-gray-500 dark:text-gray-400">
                              {teacher.email}
                            </div>
                          </div>
                          <CoachBadge tone={teacher.classrooms?.length ? "sky" : "slate"}>
                            {teacher.classrooms?.length || 0} rooms
                          </CoachBadge>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {teacher.classrooms?.length ? (
                            teacher.classrooms.map((classroom) => (
                              <CoachBadge key={classroom.id} tone="sky">
                                {classroom.name}
                              </CoachBadge>
                            ))
                          ) : (
                            <CoachBadge tone="slate">No classroom assignment</CoachBadge>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Link
                            href={`/coach/observations?teacherId=${teacher.id}&centerId=${centerId}`}
                            className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
                          >
                            Observe
                          </Link>
                          <Link
                            href={buildTeacherMessageLink(centerId, teacher)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/coach/follow-ups?assignedToId=${teacher.id}&centerId=${centerId}`}
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            Follow-up
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CoachPanel>

              <CoachPanel
                title="Checklist Plans"
                description="Monitor active plans and spotlight the highest-risk checklist items."
                action={
                  <Link
                    href={`/coach/checklists?centerId=${centerId}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Open Checklists
                  </Link>
                }
              >
                {checklistSummary.length === 0 ? (
                  <CoachEmptyPanel
                    title="No active checklist plans."
                    description="When checklist plans are active for this center, completion and priority hotspots will show here."
                  />
                ) : (
                  <div className="space-y-3">
                    {checklistSummary.map((plan) => {
                      const percent = plan.totalItems
                        ? Math.round((plan.completedItems / plan.totalItems) * 100)
                        : 0;
                      const priorityCount = (plan.items || []).filter(
                        (item) => item.priority === "CRITICAL" || item.priority === "HIGH",
                      ).length;

                      return (
                        <div
                          key={plan.id}
                          className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="break-words text-sm font-black text-gray-900 dark:text-gray-100">
                                {plan.title}
                              </div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Period: {plan.period || "Not set"}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <CoachBadge tone="emerald">
                                {plan.completedItems}/{plan.totalItems} complete
                              </CoachBadge>
                              {priorityCount ? (
                                <CoachBadge tone="amber">{priorityCount} high priority</CoachBadge>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percent === 100
                                  ? "bg-emerald-500"
                                  : percent >= 60
                                    ? "bg-sky-500"
                                    : "bg-amber-500"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          {(plan.items || []).some(
                            (item) => item.priority === "CRITICAL" || item.priority === "HIGH",
                          ) ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {plan.items
                                .filter(
                                  (item) =>
                                    item.priority === "CRITICAL" || item.priority === "HIGH",
                                )
                                .slice(0, 4)
                                .map((item) => (
                                  <CoachBadge
                                    key={item.id}
                                     tone={item.priority === "CRITICAL" ? "rose" : "amber"}
                                     className="max-w-full"
                                   >
                                    <span className="break-words">{item.title}</span>
                                  </CoachBadge>
                                ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CoachPanel>
            </div>

            <aside className="space-y-5">
              <CoachPanel
                title="Priority Queue"
                description="Overdue items and operational risk that need attention now."
              >
                {overdueAlarms.length === 0 ? (
                  <CoachEmptyPanel
                    title="No overdue alarms."
                    description="All active checklist items are on time right now."
                    className="py-8"
                    icon={<CheckIcon />}
                  />
                ) : (
                  <div className="space-y-3">
                    {overdueAlarms.map((alarm) => (
                      <div
                        key={alarm.id}
                        className="rounded-[1.5rem] border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-words text-sm font-black text-rose-900 dark:text-rose-200">
                              {alarm.title}
                            </div>
                            <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                              Due {formatDate(alarm.dueAt)}
                            </div>
                          </div>
                          <CoachBadge
                            tone={alarm.priority === "CRITICAL" ? "rose" : "amber"}
                          >
                            {alarm.priority || "OPEN"}
                          </CoachBadge>
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-rose-800 dark:text-rose-200">
                          <div>Plan: {alarm.plan?.title || "Unassigned plan"}</div>
                          <div>
                            Owner: {alarm.assignedTo?.name || alarm.assignedTo?.email || "Not assigned"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CoachPanel>

              <CoachPanel
                title="Coach Actions"
                description="Fast paths to the workflows a coach uses most."
              >
                <div className="grid grid-cols-1 gap-3">
                  <CoachActionCard
                    href={`/coach/observations?centerId=${centerId}`}
                    title="Observation Log"
                    description="Capture in-class and camera observations with notes and scoring."
                    tone="sky"
                    icon={<EyeIcon />}
                  />
                  <CoachActionCard
                    href={`/coach/follow-ups?centerId=${centerId}`}
                    title="Follow-ups"
                    description="Track open parent, classroom, and general coaching actions."
                    tone="amber"
                    icon={<ChecklistIcon />}
                  />
                  <CoachActionCard
                    href={`/coach/compliance?centerId=${centerId}`}
                    title="Compliance Review"
                    description="See which teachers are logging consistently and who needs a nudge."
                    tone="emerald"
                    icon={<CheckIcon />}
                  />
                  <CoachActionCard
                    href={`/coach/messages?centerId=${centerId}`}
                    title="Team Messaging"
                    description="Jump directly into center-specific conversations."
                    tone="slate"
                    icon={<MessageIcon />}
                  />
                </div>
              </CoachPanel>

              <CoachPanel
                title="Recent Observations"
                description="Most recent observation entries for this center."
              >
                {recentObservations.length === 0 ? (
                  <CoachEmptyPanel
                    title="No observations logged yet."
                    description="The most recent observation notes will surface here once coaches start recording visits."
                    className="py-8"
                    icon={<EyeIcon />}
                  />
                ) : (
                  <div className="space-y-3">
                    {recentObservations.map((observation) => (
                      <div
                        key={observation.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-words text-sm font-black text-gray-900 dark:text-gray-100">
                              {observation.teacher?.name || observation.teacher?.email || "Teacher"}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(observation.date)}
                              {observation.classRoom?.name ? ` - ${observation.classRoom.name}` : ""}
                            </div>
                          </div>
                          <CoachBadge tone={observation.type === "CAMERA" ? "amber" : "sky"}>
                            {observation.type === "CAMERA" ? "Camera" : "In class"}
                          </CoachBadge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {observation.score != null ? (
                            <CoachBadge tone="emerald">Score {observation.score}</CoachBadge>
                          ) : null}
                          <CoachBadge tone="slate">Observation</CoachBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CoachPanel>

              <CoachPanel title="Operational Snapshot" description="A quick read on today's current coaching posture.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SnapshotRow
                    label="Open follow-ups"
                    value={String(openFollowUps)}
                    tone="amber"
                    detail={`${followUpCounts.PARENT || 0} parent, ${followUpCounts.CAMERA_OBSERVATION || 0} camera`}
                  />
                  <SnapshotRow
                    label="Priority checklist items"
                    value={String(criticalChecklistItems)}
                    tone="rose"
                    detail="High and critical items across active plans"
                  />
                  <SnapshotRow
                    label="Recent observations"
                    value={String(recentObservations.length)}
                    tone="sky"
                    detail="Newest 5 entries shown"
                  />
                </div>
              </CoachPanel>
            </aside>
          </div>
        ) : null}
      </div>
    </CoachLayout>
  );
}

function SnapshotRow({ label, value, detail, tone }) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
  };

  return (
    <div
      className={`rounded-[1.4rem] border p-4 ${toneClasses[tone] || toneClasses.sky}`}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm opacity-80">{detail}</div>
    </div>
  );
}

function buildTeacherMessageLink(centerId, teacher) {
  const params = new URLSearchParams();
  if (centerId) params.set("centerId", centerId);
  params.set("compose", "1");
  params.set("recipientId", teacher.id);
  params.set("recipientName", teacher.name || teacher.email || "Teacher");
  if (teacher.email) params.set("recipientEmail", teacher.email);
  params.set("recipientRole", "TEACHER");
  params.set("subject", "Coaching follow-up");

  return `/coach/messages?${params.toString()}`;
}

function initials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "T";
}

function formatHeaderDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 00-12 0M14.25 9.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM20.25 14.25a2.25 2.25 0 10-4.5 0M8.25 14.25a2.25 2.25 0 10-4.5 0" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h11.25M9 12h11.25M9 17.25h11.25M3.75 7.5l1.5 1.5 3-3M3.75 12.75l1.5 1.5 3-3M3.75 18l1.5 1.5 3-3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm8.25-4.86c0 5.027-3.94 9.11-8.85 9.11S2.55 16.667 2.55 11.64 6.49 2.53 11.4 2.53s8.85 4.083 8.85 9.11z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18l-1.147-2.096L5.757 15l2.096-1.147L9 11.757l.813 2.096L11.91 15l-2.097.904zM18 9l-.822 2.178L15 12l2.178.822L18 15l.822-2.178L21 12l-2.178-.822L18 9zM12 3l1.178 3.072L16 7.25l-2.822 1.178L12 11.5l-1.178-3.072L8 7.25l2.822-1.178L12 3z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25A2.25 2.25 0 1012 9.75a2.25 2.25 0 000 4.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 9.75h9m-9 3h5.25m-8.25 7.5l3.07-3.07a1.5 1.5 0 011.06-.44H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.94a1.5 1.5 0 011.06.44l.75.75" />
    </svg>
  );
}
