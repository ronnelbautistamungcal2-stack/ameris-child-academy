// A step of progression is stored as a Lesson row. These helpers cover the
// fields that place a step in a sequence: the age it is expected at, and the
// prior/next steps that progression tracking falls back to or advances to.

// Ranges come from the client spec (Curriculum sheet, Add Step pop-up).
export const STEP_AGE_YEAR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0-12
export const STEP_AGE_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

function parseAgePart(value, options, label) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || !options.includes(n)) {
    return { error: `${label} must be between ${options[0]} and ${options[options.length - 1]}` };
  }
  return { value: n };
}

// Returns { data, error }. Keys left out of the body stay undefined so a PUT
// only touches the fields it was sent.
export function parseStepAge(body) {
  const years = parseAgePart(body.ageYears, STEP_AGE_YEAR_OPTIONS, "Age (years)");
  if (years.error) return { error: years.error };
  const months = parseAgePart(body.ageMonths, STEP_AGE_MONTH_OPTIONS, "Age (months)");
  if (months.error) return { error: months.error };
  return { data: { ageYears: years.value, ageMonths: months.value } };
}

// Prior/next steps must be other steps in the same center. Returns an error
// message, or null when the links are valid. Pass lessonId when editing.
export async function validateStepLinks(db, { lessonId, centerId, priorStepId, nextStepId }) {
  const links = [
    ["Prior step", priorStepId],
    ["Next step", nextStepId],
  ].filter(([, id]) => id);
  for (const [label, id] of links) {
    if (lessonId && id === lessonId) return `${label} cannot be the step itself`;
    const linked = await db.lesson.findUnique({ where: { id }, select: { centerId: true } });
    if (!linked) return `${label} could not be found`;
    if (linked.centerId !== centerId) return `${label} must belong to the same center`;
  }
  if (priorStepId && priorStepId === nextStepId) return "Prior step and next step must be different";
  return null;
}

export function formatStepAge(lesson) {
  const parts = [];
  if (lesson?.ageYears != null) parts.push(`${lesson.ageYears} yr`);
  if (lesson?.ageMonths != null) parts.push(`${lesson.ageMonths} mo`);
  return parts.join(" ");
}
