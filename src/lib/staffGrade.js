// Staff Overall Grade (client requests 2026-10-22/23): each center sets, on
// the Add/Edit Center form, how much evaluations, checklist and HR count
// (adding up to 100), then a % taken off per citation and added per
// commendation. Each weighted part is a 0–100 %:
//   Evaluations – latest evaluation score out of 10
//   Checklist   – share of due checklist items ticked
//   HR          – hours worked / scheduled shift hours (max 100)
// A part with no data (e.g. no evaluation yet) is left out and the others are
// scaled up. Then: grade = weighted parts − citations × citationPct
// + commendations × commendationPct, kept between 0 and 100.

export const STAFF_GRADE_PARTS = [
  { key: "evaluations", label: "Evaluations" },
  { key: "checklist", label: "Checklist" },
  { key: "hr", label: "HR" },
];

export const DEFAULT_STAFF_GRADE_WEIGHTS = {
  evaluations: 40,
  checklist: 40,
  hr: 20,
  citationPct: 5,
  commendationPct: 5,
};

function number(value, min, max) {
  if (value === "" || value === null || value === undefined) return null;
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
  if (Math.abs(total - 100) > 0.01) return { error: `Evaluations, Checklist and HR must add up to 100% (they add up to ${total}%)` };
  for (const [key, label] of [["citationPct", "% taken off per citation"], ["commendationPct", "% added per commendation"]]) {
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
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * The parts as 0–100 % (null = no data), the citation/commendation
 * adjustments in points, and the overall grade (null when no part has data).
 * Inputs: evaluationScore (0–10) | null, checklistPct | null, citations,
 * commendations (counts), hoursWorked, hoursScheduled.
 */
export function staffOverallGrade(inputs, weights = DEFAULT_STAFF_GRADE_WEIGHTS) {
  const parts = {
    evaluations: inputs.evaluationScore == null ? null : round1(clamp((inputs.evaluationScore / 10) * 100)),
    checklist: inputs.checklistPct == null ? null : round1(clamp(inputs.checklistPct)),
    hr: inputs.hoursScheduled > 0 ? round1(clamp(((inputs.hoursWorked || 0) / inputs.hoursScheduled) * 100)) : null,
  };
  const adjustments = {
    citations: -round1((inputs.citations || 0) * weights.citationPct),
    commendations: round1((inputs.commendations || 0) * weights.commendationPct),
  };
  let weightSum = 0;
  let raw = 0;
  for (const { key } of STAFF_GRADE_PARTS) {
    if (parts[key] == null || !weights[key]) continue;
    weightSum += weights[key];
    raw += parts[key] * weights[key];
  }
  const grade = weightSum ? round1(clamp(raw / weightSum + adjustments.citations + adjustments.commendations)) : null;
  return { parts, adjustments, grade };
}

/** Hours of a shift ("HH:MM" start/end). */
export function shiftHours(shift) {
  const [sh, sm] = String(shift.startTime || "").split(":").map(Number);
  const [eh, em] = String(shift.endTime || "").split(":").map(Number);
  const minutes = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  return Number.isFinite(minutes) && minutes > 0 ? minutes / 60 : 0;
}

/** "40% evaluations · 40% checklist · 20% HR · −5% per citation · +5% per commendation". */
export function formatStaffGradeFormula(weights = DEFAULT_STAFF_GRADE_WEIGHTS) {
  const parts = STAFF_GRADE_PARTS.filter(({ key }) => weights[key]).map(({ key, label }) => `${weights[key]}% ${key === "hr" ? label : label.toLowerCase()}`);
  if (weights.citationPct) parts.push(`−${weights.citationPct}% per citation`);
  if (weights.commendationPct) parts.push(`+${weights.commendationPct}% per commendation`);
  return parts.join(" · ");
}
