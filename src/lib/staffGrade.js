// Staff Overall Grade (client request 2026-10-22): each center sets the
// weight of evaluations, checklist, citations, commendations and HR on the
// Add/Edit Center form instead of the formula living in code. Each part is a
// 0–100 %:
//   Evaluations   – latest evaluation score out of 10
//   Checklist     – share of due checklist items ticked
//   Citations     – starts at 100, minus `citationPoints` per citation
//   Commendations – `commendationPoints` per commendation, up to 100
//   HR            – hours worked / scheduled shift hours (max 100)
// A part with no data (e.g. no evaluation yet) is left out and the others are
// scaled up so the weights still add to 100.

export const STAFF_GRADE_PARTS = [
  { key: "evaluations", label: "Evaluations" },
  { key: "checklist", label: "Checklist" },
  { key: "citations", label: "Citations" },
  { key: "commendations", label: "Commendations" },
  { key: "hr", label: "HR" },
];

export const DEFAULT_STAFF_GRADE_WEIGHTS = {
  evaluations: 30,
  checklist: 30,
  citations: 15,
  commendations: 10,
  hr: 15,
  citationPoints: 25,
  commendationPoints: 25,
};

function number(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
}

/** Validates the form's weights. Returns { value } or { error }. */
export function parseStaffGradeWeights(input) {
  if (!input || typeof input !== "object") return { error: "Staff grade weights are invalid" };
  const value = {};
  for (const { key, label } of STAFF_GRADE_PARTS) {
    const n = number(input[key], 0, 100);
    if (n === null) return { error: `${label} % must be between 0 and 100` };
    value[key] = n;
  }
  const total = STAFF_GRADE_PARTS.reduce((sum, { key }) => sum + value[key], 0);
  if (Math.abs(total - 100) > 0.01) return { error: `The staff grade percentages must add up to 100 (they add up to ${total})` };
  for (const [key, label] of [["citationPoints", "Points taken off per citation"], ["commendationPoints", "Points per commendation"]]) {
    const n = number(input[key], 0, 100);
    if (n === null) return { error: `${label} must be between 0 and 100` };
    value[key] = n;
  }
  return { value };
}

/** The center's weights, falling back to the defaults. */
export function staffGradeWeightsFor(center) {
  const parsed = center?.staffGradeWeights ? parseStaffGradeWeights(center.staffGradeWeights) : null;
  return parsed?.value || DEFAULT_STAFF_GRADE_WEIGHTS;
}

const clamp = (n) => Math.max(0, Math.min(100, n));

/**
 * The parts as 0–100 % (null = no data) and the weighted overall grade.
 * Inputs: evaluationScore (0–10) | null, checklistPct | null, citations,
 * commendations (counts), hoursWorked, hoursScheduled.
 */
export function staffOverallGrade(inputs, weights = DEFAULT_STAFF_GRADE_WEIGHTS) {
  const parts = {
    evaluations: inputs.evaluationScore == null ? null : clamp((inputs.evaluationScore / 10) * 100),
    checklist: inputs.checklistPct == null ? null : clamp(inputs.checklistPct),
    citations: clamp(100 - (inputs.citations || 0) * weights.citationPoints),
    commendations: clamp((inputs.commendations || 0) * weights.commendationPoints),
    hr: inputs.hoursScheduled > 0 ? clamp(((inputs.hoursWorked || 0) / inputs.hoursScheduled) * 100) : null,
  };
  let weightSum = 0;
  let raw = 0;
  for (const { key } of STAFF_GRADE_PARTS) {
    if (parts[key] == null || !weights[key]) continue;
    weightSum += weights[key];
    raw += parts[key] * weights[key];
  }
  for (const key of Object.keys(parts)) if (parts[key] != null) parts[key] = Math.round(parts[key] * 10) / 10;
  return { parts, grade: weightSum ? Math.round((raw / weightSum) * 10) / 10 : null };
}

/** Hours of a shift ("HH:MM" start/end). */
export function shiftHours(shift) {
  const [sh, sm] = String(shift.startTime || "").split(":").map(Number);
  const [eh, em] = String(shift.endTime || "").split(":").map(Number);
  const minutes = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  return Number.isFinite(minutes) && minutes > 0 ? minutes / 60 : 0;
}

/** "30% evaluations · 30% checklist · 15% citations · 10% commendations · 15% HR". */
export function formatStaffGradeFormula(weights = DEFAULT_STAFF_GRADE_WEIGHTS) {
  return STAFF_GRADE_PARTS.filter(({ key }) => weights[key])
    .map(({ key, label }) => `${weights[key]}% ${key === "hr" ? label : label.toLowerCase()}`)
    .join(" · ");
}
