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
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";

const INITIAL_FORM = {
  teacherId: "",
  type: "IN_CLASS",
  classRoomId: "",
  date: new Date().toISOString().slice(0, 10),
  duration: "",
  score: "",
  strengths: "",
  improvements: "",
  actionItems: "",
  notes: "",
};

export default function CoachObservations() {
  const router = useRouter();
  const { centerId: qCenterId, teacherId: qTeacherId } = router.query;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [observations, setObservations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
        setCenterId(String(qCenterId || (nextCenters.length === 1 ? nextCenters[0].id : "")));
      } catch {
        // ignore and let later fetch surface errors
      }
    })();
  }, [qCenterId]);

  useEffect(() => {
    if (!qTeacherId) return;
    setTeacherFilter(String(qTeacherId));
    setShowForm(true);
    setForm((current) => ({ ...current, teacherId: String(qTeacherId) }));
  }, [qTeacherId]);

  useEffect(() => {
    if (!centerId) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const observationParams = new URLSearchParams({ centerId });
        if (teacherFilter) observationParams.set("teacherId", teacherFilter);

        const [observationResponse, dashboardResponse] = await Promise.all([
          apiJson(`/api/v1/coach/observations?${observationParams.toString()}`),
          apiJson(`/api/v1/coach/dashboard?centerId=${encodeURIComponent(centerId)}`),
        ]);

        setObservations(Array.isArray(observationResponse) ? observationResponse : []);
        setTeachers(dashboardResponse?.teachers || []);

        const classroomMap = new Map();
        for (const teacher of dashboardResponse?.teachers || []) {
          for (const classroom of teacher.classrooms || []) {
            classroomMap.set(classroom.id, classroom);
          }
        }
        setClassrooms([...classroomMap.values()]);
      } catch (err) {
        setError(err.message || "Failed to load observations");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId, teacherFilter]);

  const filteredObservations =
    filterType === "ALL"
      ? observations
      : observations.filter((observation) => observation.type === filterType);

  const scoredObservations = filteredObservations.filter((entry) => entry.score != null);
  const averageScore = scoredObservations.length
    ? (
        scoredObservations.reduce((sum, entry) => sum + Number(entry.score || 0), 0) /
        scoredObservations.length
      ).toFixed(1)
    : "-";
  const cameraCount = filteredObservations.filter((entry) => entry.type === "CAMERA").length;
  const inClassCount = filteredObservations.filter((entry) => entry.type === "IN_CLASS").length;
  const actionItemCount = filteredObservations.filter((entry) => entry.actionItems).length;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.teacherId || !centerId) return;

    setSaving(true);
    setError("");

    try {
      const created = await apiJson("/api/v1/coach/observations", {
        method: "POST",
        body: JSON.stringify({ ...form, centerId }),
      });

      const matchesTeacher = !teacherFilter || created.teacher?.id === teacherFilter;
      const matchesType = filterType === "ALL" || created.type === filterType;

      if (matchesTeacher && matchesType) {
        setObservations((current) => [created, ...current]);
      } else if (!teacherFilter) {
        setObservations((current) => [created, ...current]);
      }

      setShowForm(false);
      setForm({
        ...INITIAL_FORM,
        teacherId: teacherFilter || "",
      });
    } catch (err) {
      setError(err.message || "Failed to save observation");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this observation?")) return;

    try {
      await apiJson(`/api/v1/coach/observations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setObservations((current) => current.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete observation");
    }
  }

  const centerName = centers.find((center) => center.id === centerId)?.name || "";
  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherFilter);

  return (
    <CoachLayout title="Observations">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Observation Desk"
          title="Capture classroom evidence while the details are still fresh."
          description="Use one flow for camera reviews and in-class visits, then keep strengths, coaching notes, and next actions tied to the right teacher."
          meta={
            <>
              {centerName ? <CoachBadge tone="sky">{centerName}</CoachBadge> : null}
              {selectedTeacher ? (
                <CoachBadge tone="amber">
                  Focused on {selectedTeacher.name || selectedTeacher.email}
                </CoachBadge>
              ) : null}
              <CoachBadge tone="slate">{filteredObservations.length} visible entries</CoachBadge>
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
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
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Teacher Focus
                </div>
                <select
                  value={teacherFilter}
                  onChange={(event) => {
                    setTeacherFilter(event.target.value);
                    setForm((current) => ({
                      ...current,
                      teacherId: event.target.value || current.teacherId,
                    }));
                  }}
                  className={coachInputClass}
                  disabled={!centerId}
                >
                  <option value="">All teachers</option>
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
                  onClick={() => {
                    setShowForm((current) => !current);
                    if (!showForm) {
                      setForm((current) => ({ ...current, teacherId: teacherFilter || current.teacherId }));
                    }
                  }}
                  className={showForm ? coachSecondaryButtonClass : coachPrimaryButtonClass}
                >
                  {showForm ? "Close Form" : "New Observation"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("ALL");
                    setTeacherFilter("");
                  }}
                  className={coachSecondaryButtonClass}
                >
                  Clear Filters
                </button>
              </div>
            ) : null
          }
          stats={
            centerId ? (
              <>
                <CoachMetricCard
                  label="Visible Entries"
                  value={String(filteredObservations.length)}
                  hint="Observation records in view"
                  tone="sky"
                  icon={<EyeIcon />}
                />
                <CoachMetricCard
                  label="Average Score"
                  value={String(averageScore)}
                  hint="Across scored observations"
                  tone="emerald"
                  icon={<SparkIcon />}
                />
                <CoachMetricCard
                  label="In-class vs Camera"
                  value={`${inClassCount}/${cameraCount}`}
                  hint="Current filter split"
                  tone="amber"
                  icon={<SplitIcon />}
                />
                <CoachMetricCard
                  label="Action Items"
                  value={String(actionItemCount)}
                  hint="Entries with next steps"
                  tone="rose"
                  icon={<ChecklistIcon />}
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
            title="Select a center to load observations."
            description="Observation history is organized per center so the coaching context, classrooms, and teachers stay aligned."
          />
        ) : null}

        {centerId && showForm ? (
          <CoachPanel
            title="New Observation"
            description="Capture what happened, what went well, and what should happen next."
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Field label="Observation Type">
                  <select
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                    className={coachInputClass}
                  >
                    <option value="IN_CLASS">In class</option>
                    <option value="CAMERA">Camera</option>
                  </select>
                </Field>

                <Field label="Teacher">
                  <select
                    value={form.teacherId}
                    onChange={(event) => setForm({ ...form, teacherId: event.target.value })}
                    className={coachInputClass}
                    required
                  >
                    <option value="">Select teacher...</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name || teacher.email}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Classroom">
                  <select
                    value={form.classRoomId}
                    onChange={(event) => setForm({ ...form, classRoomId: event.target.value })}
                    className={coachInputClass}
                  >
                    <option value="">Select classroom...</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                    className={coachInputClass}
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(event) => setForm({ ...form, duration: event.target.value })}
                    className={coachInputClass}
                    placeholder="30"
                  />
                </Field>
                <Field label="Score (0 to 5)">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.score}
                    onChange={(event) => setForm({ ...form, score: event.target.value })}
                    className={coachInputClass}
                    placeholder="4.2"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Field
                  label="Strengths"
                  hint="What should this teacher keep doing?"
                >
                  <textarea
                    value={form.strengths}
                    onChange={(event) => setForm({ ...form, strengths: event.target.value })}
                    className={coachTextareaClass}
                    rows={4}
                  />
                </Field>

                <Field
                  label="Areas for Improvement"
                  hint="What needs coaching attention?"
                >
                  <textarea
                    value={form.improvements}
                    onChange={(event) => setForm({ ...form, improvements: event.target.value })}
                    className={coachTextareaClass}
                    rows={4}
                  />
                </Field>

                <Field
                  label="Action Items"
                  hint="List the concrete next steps."
                >
                  <textarea
                    value={form.actionItems}
                    onChange={(event) => setForm({ ...form, actionItems: event.target.value })}
                    className={coachTextareaClass}
                    rows={4}
                  />
                </Field>

                <Field
                  label="Notes"
                  hint="Capture context or anything you want to remember later."
                >
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
                  {saving ? "Saving..." : "Save Observation"}
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
            title="Observation History"
            description="Filter by observation type or teacher focus to review patterns quickly."
          >
            <div className="flex flex-wrap gap-2">
              <CoachChipButton
                active={filterType === "ALL"}
                onClick={() => setFilterType("ALL")}
                tone="slate"
              >
                All Types
              </CoachChipButton>
              <CoachChipButton
                active={filterType === "IN_CLASS"}
                onClick={() => setFilterType("IN_CLASS")}
                tone="sky"
              >
                In Class
              </CoachChipButton>
              <CoachChipButton
                active={filterType === "CAMERA"}
                onClick={() => setFilterType("CAMERA")}
                tone="amber"
              >
                Camera
              </CoachChipButton>
            </div>

            {loading ? (
              <div className="mt-4">
                <SkeletonTable rows={5} cols={4} />
              </div>
            ) : filteredObservations.length === 0 ? (
              <div className="mt-4">
                <CoachEmptyPanel
                  title="No observations match the current view."
                  description="Adjust the teacher focus or type filter, or create a new observation to start building a coaching record."
                  action={
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className={coachPrimaryButtonClass}
                    >
                      New Observation
                    </button>
                  }
                  icon={<EyeIcon />}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredObservations.map((observation) => (
                  <div
                    key={observation.id}
                    className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-black text-gray-900 dark:text-gray-100">
                            {observation.teacher?.name || observation.teacher?.email || "Teacher"}
                          </div>
                          <CoachBadge tone={observation.type === "CAMERA" ? "amber" : "sky"}>
                            {observation.type === "CAMERA" ? "Camera" : "In class"}
                          </CoachBadge>
                          {observation.score != null ? (
                            <CoachBadge tone="emerald">Score {observation.score}/5</CoachBadge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(observation.date)}</span>
                          {observation.classRoom?.name ? <span>{observation.classRoom.name}</span> : null}
                          {observation.duration ? <span>{observation.duration} min</span> : null}
                          {observation.coach ? (
                            <span>
                              by {observation.coach.name || observation.coach.email}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(observation.id)}
                        className={coachDangerButtonClass}
                      >
                        Delete
                      </button>
                    </div>

                    {(observation.strengths ||
                      observation.improvements ||
                      observation.actionItems ||
                      observation.notes) && (
                      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {observation.strengths ? (
                          <ObservationNote
                            title="Strengths"
                            value={observation.strengths}
                            tone="emerald"
                          />
                        ) : null}
                        {observation.improvements ? (
                          <ObservationNote
                            title="Improvement Areas"
                            value={observation.improvements}
                            tone="amber"
                          />
                        ) : null}
                        {observation.actionItems ? (
                          <ObservationNote
                            title="Action Items"
                            value={observation.actionItems}
                            tone="sky"
                          />
                        ) : null}
                        {observation.notes ? (
                          <ObservationNote title="Notes" value={observation.notes} tone="slate" />
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CoachPanel>
        ) : null}
      </div>
    </CoachLayout>
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

function ObservationNote({ title, value, tone }) {
  const tones = {
    emerald:
      "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    amber: "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20",
    sky: "border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20",
    slate: "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50",
  };

  return (
    <div className={`rounded-[1.4rem] border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {title}
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25A2.25 2.25 0 1012 9.75a2.25 2.25 0 000 4.5z" />
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

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 6.75h13.5M5.25 12h7.5M5.25 17.25h13.5" />
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
