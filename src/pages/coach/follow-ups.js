import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachChipButton,
  CoachEmptyPanel,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachDangerButtonClass,
  coachInputClass,
  coachPrimaryButtonClass,
  coachSecondaryButtonClass,
  coachTextareaClass,
} from "@/components/coach/CoachPage";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { SkeletonTable } from "@/components/ui/Skeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { apiJson } from "@/lib/api";

const TYPES = [
  { value: "PARENT", label: "Parent", tone: "amber" },
  { value: "CAMERA_OBSERVATION", label: "Camera", tone: "sky" },
  { value: "GENERAL", label: "General", tone: "slate" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const STATUSES = [
  { value: "OPEN", label: "Open", tone: "sky" },
  { value: "IN_PROGRESS", label: "In Progress", tone: "amber" },
  { value: "COMPLETED", label: "Completed", tone: "emerald" },
  { value: "CANCELLED", label: "Cancelled", tone: "slate" },
];

const INITIAL_FORM = {
  type: "PARENT",
  priority: "MEDIUM",
  title: "",
  description: "",
  dueDate: "",
  assignedToId: "",
  notes: "",
};

export default function CoachFollowUps() {
  const router = useRouter();
  const { assignedToId: qAssignedToId } = router.query;
  const toast = useToast();

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("OPEN");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
      } catch {
        // ignore; subsequent calls surface real errors
      }
    })();
  }, []);

  useEffect(() => {
    if (!qAssignedToId) return;
    setAssigneeFilter(String(qAssignedToId));
    setShowForm(true);
    setForm((current) => ({ ...current, assignedToId: String(qAssignedToId) }));
  }, [qAssignedToId]);

  useEffect(() => {
    if (!assigneeFilter) return;
    if (teachers.some((teacher) => teacher.id === assigneeFilter)) return;

    setAssigneeFilter("");
    setForm((current) => ({
      ...current,
      assignedToId:
        current.assignedToId === assigneeFilter ? "" : current.assignedToId,
    }));
  }, [assigneeFilter, teachers]);

  useEffect(() => {
    if (!centerId) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ centerId });
        if (filterStatus !== "ALL") params.set("status", filterStatus);
        if (filterType !== "ALL") params.set("type", filterType);

        const [followUpResponse, dashboardResponse] = await Promise.all([
          apiJson(`/api/v1/coach/follow-ups?${params.toString()}`),
          apiJson(`/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`),
        ]);

        setFollowUps(Array.isArray(followUpResponse) ? followUpResponse : []);
        setTeachers(dashboardResponse?.teachers || []);
      } catch (err) {
        setError(err.message || "Failed to load follow-ups");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, filterStatus, filterType]);

  const visibleFollowUps = assigneeFilter
    ? followUps.filter((followUp) => followUp.assignedTo?.id === assigneeFilter)
    : followUps;

  const openCount = visibleFollowUps.filter((item) => item.status === "OPEN").length;
  const inProgressCount = visibleFollowUps.filter((item) => item.status === "IN_PROGRESS").length;
  const completedCount = visibleFollowUps.filter((item) => item.status === "COMPLETED").length;
  const overdueCount = visibleFollowUps.filter((item) => isOverdue(item)).length;
  const highPriorityCount = visibleFollowUps.filter(
    (item) => item.priority === "HIGH" || item.priority === "CRITICAL",
  ).length;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title || !centerId) return;

    setSaving(true);
    setError("");

    try {
      const created = await apiJson("/api/v1/coach/follow-ups", {
        method: "POST",
        body: JSON.stringify({ ...form, centerId }),
      });

      const matchesAssignee = !assigneeFilter || created.assignedTo?.id === assigneeFilter;
      if (matchesAssignee) {
        setFollowUps((current) => [created, ...current]);
      }

      setShowForm(false);
      setForm({
        ...INITIAL_FORM,
        assignedToId: assigneeFilter || "",
      });
      toast.success("Follow-up created.");
    } catch (err) {
      const message = err.message || "Failed to save follow-up";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    setError("");
    try {
      const updated = await apiJson("/api/v1/coach/follow-ups", {
        method: "PUT",
        body: JSON.stringify({ id, status }),
      });
      setFollowUps((current) => current.map((item) => (item.id === id ? updated : item)));
      toast.success(`Follow-up marked ${statusLabel(status).toLowerCase()}.`);
    } catch (err) {
      const message = err.message || "Failed to update follow-up";
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete() {
    if (!confirmingDeleteId) return;
    try {
      await apiJson(`/api/v1/coach/follow-ups?id=${encodeURIComponent(confirmingDeleteId)}`, {
        method: "DELETE",
      });
      setFollowUps((current) =>
        current.filter((item) => item.id !== confirmingDeleteId),
      );
      setConfirmingDeleteId("");
      toast.success("Follow-up deleted.");
    } catch (err) {
      const message = err.message || "Failed to delete follow-up";
      setError(message);
      toast.error(message);
    }
  }

  const centerName = centers.find((center) => center.id === centerId)?.name || "";
  const selectedTeacher = teachers.find((teacher) => teacher.id === assigneeFilter);
  const followUpPendingDelete = visibleFollowUps.find(
    (followUp) => followUp.id === confirmingDeleteId,
  );

  return (
    <CoachLayout title="Follow-ups">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Follow-through"
          title="Turn coaching notes into accountable next steps."
          description="Track parent communication, camera review actions, and general coaching tasks with clear ownership and due dates."
          meta={
            <>
              {centerName ? <CoachBadge tone="sky">{centerName}</CoachBadge> : null}
              {selectedTeacher ? (
                <CoachBadge tone="amber">
                  Assigned focus: {selectedTeacher.name || selectedTeacher.email}
                </CoachBadge>
              ) : null}
              <CoachBadge tone="slate">{visibleFollowUps.length} visible items</CoachBadge>
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center View
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
                >
                  <option value="">Select a center to load follow-ups...</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Assigned Teacher
                </div>
                <select
                  value={assigneeFilter}
                  onChange={(event) => {
                    setAssigneeFilter(event.target.value);
                    setForm((current) => ({
                      ...current,
                      assignedToId: event.target.value || current.assignedToId,
                    }));
                  }}
                  className={coachInputClass}
                  disabled={!centerId}
                >
                  <option value="">All assignees</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name || teacher.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          actions={
            centerId ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setShowForm((current) => !current)}
                  className={showForm ? coachSecondaryButtonClass : coachPrimaryButtonClass}
                >
                  {showForm ? "Close Form" : "New Follow-up"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssigneeFilter("");
                    setFilterStatus("OPEN");
                    setFilterType("ALL");
                  }}
                  className={coachSecondaryButtonClass}
                >
                  Reset Filters
                </button>
              </div>
            ) : null
          }
          stats={
            centerId ? (
              <>
                <CoachMetricCard
                  label="Open"
                  value={String(openCount)}
                  hint="Awaiting action"
                  tone="sky"
                  icon={<OpenIcon />}
                />
                <CoachMetricCard
                  label="In Progress"
                  value={String(inProgressCount)}
                  hint="Actively being handled"
                  tone="amber"
                  icon={<ProgressIcon />}
                />
                <CoachMetricCard
                  label="Overdue"
                  value={String(overdueCount)}
                  hint="Past due and still active"
                  tone={overdueCount ? "rose" : "emerald"}
                  icon={<AlertIcon />}
                />
                <CoachMetricCard
                  label="High Priority"
                  value={String(highPriorityCount)}
                  hint={`${completedCount} completed in view`}
                  tone="rose"
                  icon={<FlagIcon />}
                />
              </>
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
            title="Select a center to load follow-ups."
            description="Follow-up work is scoped per center so assignment, context, and due dates stay aligned to the right team."
          />
        ) : null}

        {centerId && showForm ? (
          <CoachPanel
            title="New Follow-up"
            description="Create a clear next step with a due date, owner, and context."
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <Field label="Type">
                  <select
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                    className={coachInputClass}
                  >
                    {TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    className={coachInputClass}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Assigned Teacher">
                  <select
                    value={form.assignedToId}
                    onChange={(event) => setForm({ ...form, assignedToId: event.target.value })}
                    className={coachInputClass}
                  >
                    <option value="">Unassigned</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name || teacher.email}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Due Date">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                    className={coachInputClass}
                  />
                </Field>
              </div>

              <Field label="Title">
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className={coachInputClass}
                  placeholder="Parent callback about behavior transition"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Field label="Description" hint="Why this follow-up matters and what it should cover.">
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className={coachTextareaClass}
                    rows={4}
                  />
                </Field>

                <Field label="Notes" hint="Anything the assignee should keep in mind.">
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    className={coachTextareaClass}
                    rows={4}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={coachPrimaryButtonClass}>
                  {saving ? "Saving..." : "Create Follow-up"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={coachSecondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          </CoachPanel>
        ) : null}

        {centerId ? (
          <CoachPanel
            title="Follow-up Queue"
            description="Filter by type or status to see the coaching queue from different angles."
          >
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Type
                </div>
                <div className="flex flex-wrap gap-2">
                  <CoachChipButton
                    active={filterType === "ALL"}
                    onClick={() => setFilterType("ALL")}
                    tone="slate"
                  >
                    All Types
                  </CoachChipButton>
                  {TYPES.map((type) => (
                    <CoachChipButton
                      key={type.value}
                      active={filterType === type.value}
                      onClick={() => setFilterType(type.value)}
                      tone={type.tone}
                    >
                      {type.label}
                    </CoachChipButton>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Status
                </div>
                <div className="flex flex-wrap gap-2">
                  <CoachChipButton
                    active={filterStatus === "ALL"}
                    onClick={() => setFilterStatus("ALL")}
                    tone="slate"
                  >
                    Any Status
                  </CoachChipButton>
                  {STATUSES.map((status) => (
                    <CoachChipButton
                      key={status.value}
                      active={filterStatus === status.value}
                      onClick={() => setFilterStatus(status.value)}
                      tone={status.tone}
                    >
                      {status.label}
                    </CoachChipButton>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-4">
                <SkeletonTable rows={5} cols={4} />
              </div>
            ) : visibleFollowUps.length === 0 ? (
              <div className="mt-4">
                <CoachEmptyPanel
                  title="No follow-ups match this view."
                  description="Adjust the filters or create a new follow-up to start tracking coaching work."
                  action={
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className={coachPrimaryButtonClass}
                    >
                      New Follow-up
                    </button>
                  }
                  icon={<ChecklistIcon />}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleFollowUps.map((followUp) => (
                  <FollowUpCard
                    key={followUp.id}
                    followUp={followUp}
                    onStatusChange={handleStatusChange}
                    onDelete={() => setConfirmingDeleteId(followUp.id)}
                  />
                ))}
              </div>
            )}
          </CoachPanel>
        ) : null}

        <ConfirmDialog
          open={!!confirmingDeleteId}
          title="Delete follow-up?"
          message={
            followUpPendingDelete
              ? `Delete "${followUpPendingDelete.title}"? This removes the coaching item from the current queue.`
              : "Delete this follow-up?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDeleteId("")}
          variant="danger"
        />
      </div>
    </CoachLayout>
  );
}

function FollowUpCard({ followUp, onStatusChange, onDelete }) {
  const overdue = isOverdue(followUp);
  const cardTone =
    followUp.status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
      : followUp.status === "CANCELLED"
        ? "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50"
        : overdue
          ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80";

  return (
    <div className={`rounded-[1.6rem] border p-5 shadow-sm ${cardTone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="break-words text-base font-black text-gray-900 dark:text-gray-100">
              {followUp.title}
            </div>
            <CoachBadge tone={typeTone(followUp.type)}>{typeLabel(followUp.type)}</CoachBadge>
            <CoachBadge tone={priorityTone(followUp.priority)}>{followUp.priority}</CoachBadge>
            <CoachBadge tone={statusTone(followUp.status)}>{statusLabel(followUp.status)}</CoachBadge>
            {overdue ? <CoachBadge tone="rose">Overdue</CoachBadge> : null}
          </div>

          {followUp.description ? (
            <p className="mt-3 break-words text-sm leading-6 text-gray-600 dark:text-gray-400">
              {followUp.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            {followUp.assignedTo ? (
              <span className="break-words">
                Assigned to {followUp.assignedTo.name || followUp.assignedTo.email}
              </span>
            ) : (
              <span>Unassigned</span>
            )}
            {followUp.dueDate ? <span>Due {formatDate(followUp.dueDate)}</span> : null}
            <span>Created {formatDate(followUp.createdAt)}</span>
            {followUp.createdBy ? (
              <span>By {followUp.createdBy.name || followUp.createdBy.email}</span>
            ) : null}
            {followUp.completedAt ? <span>Completed {formatDate(followUp.completedAt)}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {followUp.status === "OPEN" ? (
            <button
              type="button"
              onClick={() => onStatusChange(followUp.id, "IN_PROGRESS")}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
            >
              Start
            </button>
          ) : null}

          {(followUp.status === "OPEN" || followUp.status === "IN_PROGRESS") ? (
            <button
              type="button"
              onClick={() => onStatusChange(followUp.id, "COMPLETED")}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              Complete
            </button>
          ) : null}

          {followUp.status === "IN_PROGRESS" ? (
            <button
              type="button"
              onClick={() => onStatusChange(followUp.id, "OPEN")}
              className={coachSecondaryButtonClass}
            >
              Reopen
            </button>
          ) : null}

          {(followUp.status === "OPEN" || followUp.status === "IN_PROGRESS") ? (
            <button
              type="button"
              onClick={() => onStatusChange(followUp.id, "CANCELLED")}
              className={coachSecondaryButtonClass}
            >
              Cancel
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onDelete(followUp.id)}
            className={coachDangerButtonClass}
          >
            Delete
          </button>
        </div>
      </div>

      {followUp.notes ? (
        <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            Notes
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
            {followUp.notes}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
    </label>
  );
}

function isOverdue(item) {
  if (!item?.dueDate) return false;
  if (item.status === "COMPLETED" || item.status === "CANCELLED") return false;
  return new Date(item.dueDate) < new Date(new Date().toDateString());
}

function typeLabel(type) {
  return TYPES.find((item) => item.value === type)?.label || type;
}

function typeTone(type) {
  return TYPES.find((item) => item.value === type)?.tone || "slate";
}

function priorityTone(priority) {
  if (priority === "CRITICAL") return "rose";
  if (priority === "HIGH") return "amber";
  if (priority === "MEDIUM") return "sky";
  return "slate";
}

function statusLabel(status) {
  return STATUSES.find((item) => item.value === status)?.label || status;
}

function statusTone(status) {
  return STATUSES.find((item) => item.value === status)?.tone || "slate";
}

function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 21V4.5m0 0c1.5-1.5 3.75-1.5 5.25 0s3.75 1.5 5.25 0 3.75-1.5 5.25 0V15c-1.5-1.5-3.75-1.5-5.25 0s-3.75 1.5-5.25 0-3.75-1.5-5.25 0" />
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
