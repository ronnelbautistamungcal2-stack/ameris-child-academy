// A step of progression is stored as a Lesson row. These helpers cover the
// fields that place a step in a sequence: the age it is expected at, and the
// prior/next steps that progression tracking falls back to or advances to.

// Ranges confirmed by the client: 0-18 years plus 0-11 months, so an exact
// age such as 2 years is entered as 2 yr 0 mo.
export const STEP_AGE_YEAR_OPTIONS = Array.from({ length: 19 }, (_, i) => i); // 0-18
export const STEP_AGE_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i); // 0-11

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

export const STEP_CRITERIA_LEVELS = [
  { key: "exposure", label: "Exposure" },
  { key: "competency", label: "Competency" },
  { key: "mastery", label: "Mastery" },
];

/**
 * Add Step pop-up extras: the Exposure / Competency / Mastery criteria and
 * Additional Notes. Fields left out of the body stay undefined (unchanged).
 */
export function parseStepDetails(body) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body || {}, key);
  const text = (value, max) => String(value ?? "").trim().slice(0, max) || null;
  const data = {};
  if (has("criteria")) {
    const source = body.criteria && typeof body.criteria === "object" ? body.criteria : {};
    const criteria = Object.fromEntries(STEP_CRITERIA_LEVELS.map(({ key }) => [key, text(source[key], 500)]));
    data.criteria = criteria;
  }
  if (has("notes")) data.notes = text(body.notes, 2000);
  // Optional Type (Curriculum > Categories), on steps and lessons alike.
  if (has("type")) data.type = text(body.type, 80);
  return data;
}

export function formatStepAge(lesson) {
  const parts = [];
  if (lesson?.ageYears != null) parts.push(`${lesson.ageYears} yr`);
  if (lesson?.ageMonths != null) parts.push(`${lesson.ageMonths} mo`);
  return parts.join(" ");
}

// Steps of Progression import (Excel or CSV). One column per Add Step field;
// headers are matched loosely (case, spaces and brackets ignored), so
// "Age (Years)", "age years" and "AgeYears" all work.
export const STEP_IMPORT_COLUMNS = [
  { key: "reference", header: "Ref ID", aliases: ["ref", "refid", "reference", "referenceid"] },
  { key: "title", header: "Step Description", aliases: ["stepdescription", "stepofprogression", "step", "title"] },
  { key: "category", header: "Category", aliases: ["category"] },
  { key: "subject", header: "Subject", aliases: ["subject"] },
  { key: "ageYears", header: "Age (Years)", aliases: ["ageyears", "years", "ageyrs"] },
  { key: "ageMonths", header: "Age (Months)", aliases: ["agemonths", "months", "agemos"] },
  { key: "term", header: "Term", aliases: ["term"] },
  { key: "description", header: "Assessment Question", aliases: ["assessmentquestion", "question"] },
  { key: "exposure", header: "Exposure", aliases: ["exposure"] },
  { key: "competency", header: "Competency", aliases: ["competency"] },
  { key: "mastery", header: "Mastery", aliases: ["mastery"] },
  { key: "buildsOn", header: "Builds On (Ref ID)", aliases: ["buildson", "buildsonrefid", "buildsonpreviousstep", "previousstep", "priorstep"] },
  { key: "leadsTo", header: "Leads To (Ref ID)", aliases: ["leadsto", "leadstorefid", "leadstonextstep", "nextstep"] },
  { key: "relatedLesson", header: "Related Lesson", aliases: ["relatedlesson", "relatedlessonrefid", "relatedlessonoptional", "linkedlesson"] },
  { key: "type", header: "Type", aliases: ["type", "typeoptional"] },
  { key: "notes", header: "Notes", aliases: ["notes", "additionalnotes"] },
];

const headerKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Turns sheet rows (arrays of cell values) into step objects. The header row
 * is the first one with a Ref ID or Step Description column. Returns
 * { rows: [{ line, ...fields }], missing: [header labels not found] }.
 */
export function readStepSheet(sheetRows) {
  const byAlias = new Map(STEP_IMPORT_COLUMNS.flatMap((c) => c.aliases.map((a) => [a, c.key])));
  const headerIndex = sheetRows.findIndex((row) =>
    (row || []).some((cell) => ["reference", "title"].includes(byAlias.get(headerKey(cell)))),
  );
  if (headerIndex < 0) return { rows: [], missing: ["Ref ID", "Step Description"] };
  const columns = (sheetRows[headerIndex] || []).map((cell) => byAlias.get(headerKey(cell)) || null);
  const found = new Set(columns.filter(Boolean));
  const rows = [];
  sheetRows.slice(headerIndex + 1).forEach((cells, i) => {
    const row = { line: headerIndex + i + 2 };
    columns.forEach((key, c) => {
      if (key && row[key] === undefined) row[key] = String(cells?.[c] ?? "").trim();
    });
    if (STEP_IMPORT_COLUMNS.some(({ key }) => row[key])) rows.push(row);
  });
  return {
    rows,
    missing: STEP_IMPORT_COLUMNS.filter((c) => ["reference", "title"].includes(c.key) && !found.has(c.key)).map((c) => c.header),
  };
}

// "1", "term 1" and "Term 1" all become "Term 1"; anything else is kept.
export function normalizeStepTerm(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:term\s*)?(\d+)$/i);
  return match ? `Term ${match[1]}` : text;
}
