// SOP Tracking (client request 2026-10-02): the Initial Developmental
// Assessment and the teacher's Progression Tracking, both over a child's
// progress on Steps of Progression. A child's level on a step is stored on
// the existing Progress row (one per child and step); the four levels map
// onto its status so older reports keep counting them.

export const SOP_LEVELS = [
  { value: "NOT_STARTED", label: "Not Started", status: "NOT_STARTED", hint: "Skill not yet demonstrated.", dot: "bg-red-500" },
  { value: "EXPOSURE", label: "Exposure", status: "IN_PROGRESS", hint: "Beginning to show the skill with support.", dot: "bg-orange-400" },
  { value: "COMPETENCY", label: "Competency", status: "COMPLETED", hint: "Shows the skill consistently with support.", dot: "bg-yellow-400" },
  { value: "MASTERY", label: "Mastery", status: "PASSED", hint: "Shows the skill independently in most settings.", dot: "bg-green-600" },
];
const LEVEL_VALUES = SOP_LEVELS.map((l) => l.value);

export function isLevel(value) {
  return LEVEL_VALUES.includes(value);
}

export function statusForLevel(level) {
  return SOP_LEVELS.find((l) => l.value === level)?.status || "NOT_STARTED";
}

export function levelForStatus(status) {
  if (status === "IN_PROGRESS") return "EXPOSURE";
  if (status === "COMPLETED") return "COMPETENCY";
  if (status === "PASSED") return "MASTERY";
  return "NOT_STARTED";
}

export function levelLabel(level) {
  return SOP_LEVELS.find((l) => l.value === level)?.label || "";
}

const reached = (level) => level === "COMPETENCY" || level === "MASTERY";

// ---- Status by age ----------------------------------------------------------
// Client definitions: Excelling = 1 month ahead, Ahead = 2 weeks ahead,
// On Track = milestones match current age, At Risk = 2 weeks behind,
// Critical = 1 month behind. A step's age expectation is its Age (Years) and
// Age (Months).

export const SOP_STATUSES = [
  { value: "CRITICAL", label: "Critical", bar: "bg-red-400", pill: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  { value: "AT_RISK", label: "At Risk", bar: "bg-orange-400", pill: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  { value: "ON_TRACK", label: "On Track", bar: "bg-yellow-300", pill: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200" },
  { value: "AHEAD", label: "Ahead", bar: "bg-green-300", pill: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
  { value: "EXCELLING", label: "Excelling", bar: "bg-green-700", pill: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200" },
];

const DAY = 86400000;
const MONTH_DAYS = 30.44;

/** A step's expected age in days, or null when it has none. */
export function expectedAgeDays(step) {
  if (step?.ageYears == null && step?.ageMonths == null) return null;
  return ((step.ageYears || 0) * 12 + (step.ageMonths || 0)) * MONTH_DAYS;
}

export function formatExpectedAge(step) {
  const months = (step?.ageYears || 0) * 12 + (step?.ageMonths || 0);
  if (step?.ageYears == null && step?.ageMonths == null) return "";
  if (months < 24) return `${months} months`;
  return step.ageMonths ? `${step.ageYears} yr ${step.ageMonths} mo` : `${step.ageYears} years`;
}

/**
 * Days ahead (positive) or behind (negative) for one goal: a reached step
 * that was expected later is ahead; an unreached step whose expected age has
 * passed is behind. Null without an age to compare.
 */
export function goalOffsetDays(step, level, birthDate, today = new Date()) {
  const expected = expectedAgeDays(step);
  if (expected == null || !birthDate) return null;
  const age = (today - new Date(birthDate)) / DAY;
  const diff = expected - age;
  return reached(level) ? Math.max(0, diff) : Math.min(0, diff);
}

export function statusForOffset(days) {
  if (days == null) return "ON_TRACK";
  if (days >= 30) return "EXCELLING";
  if (days >= 14) return "AHEAD";
  if (days <= -30) return "CRITICAL";
  if (days <= -14) return "AT_RISK";
  return "ON_TRACK";
}

/** A child's overall status: the average offset of their active goals. */
export function childStatus(goals, birthDate, today = new Date()) {
  const offsets = goals.map((g) => goalOffsetDays(g.step, g.level, birthDate, today)).filter((d) => d != null);
  if (!offsets.length) return "ON_TRACK";
  return statusForOffset(offsets.reduce((a, b) => a + b, 0) / offsets.length);
}

/** Share of goals in each status, as whole percentages. */
export function statusDistribution(goals, birthDate, today = new Date()) {
  const counts = Object.fromEntries(SOP_STATUSES.map((s) => [s.value, 0]));
  for (const g of goals) counts[statusForOffset(goalOffsetDays(g.step, g.level, birthDate, today))] += 1;
  const total = goals.length || 1;
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v * 100) / total)]));
}

// ---- Assessment ---------------------------------------------------------------

/**
 * The step to add under a row on the assessment: the previous step when it is
 * marked Not Started, the next step when it reaches Competency or Mastery.
 */
export function linkedStepFor(step, level) {
  if (level === "NOT_STARTED") return step.priorStepId ? { stepId: step.priorStepId, reason: "PREVIOUS" } : null;
  if (reached(level)) return step.nextStepId ? { stepId: step.nextStepId, reason: "NEXT" } : null;
  return null;
}

/**
 * "Generate Active Goals": which steps become the child's active goals, from
 * the assessed levels ({ [stepId]: level }) and the steps (with prior/next).
 * Not Started and Exposure steps are worked on; a Not Started step whose
 * previous step was also assessed gives way to that previous step;
 * Competency stays active until Mastery; reaching Competency or Mastery
 * brings in the next step unless it is already mastered.
 */
export function activeGoalIds(levels, stepsById) {
  const active = new Set();
  for (const [stepId, level] of Object.entries(levels)) {
    const step = stepsById[stepId];
    if (!step) continue;
    if (level === "NOT_STARTED") {
      if (!(step.priorStepId && levels[step.priorStepId])) active.add(stepId);
    } else if (level === "EXPOSURE") {
      active.add(stepId);
    } else {
      if (level === "COMPETENCY") active.add(stepId);
      const next = step.nextStepId;
      if (next && stepsById[next] && levels[next] !== "MASTERY") active.add(next);
    }
  }
  return [...active];
}
