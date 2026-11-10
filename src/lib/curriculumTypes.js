// Curriculum types (client 2026-11-07): each lesson and step has one or more;
// a subscriber's account lists the types they pay for. Standard is
// Non-Denominational and Faith Based is Non-Denominational Christian. Shared
// by the browser and the server, so no imports.

export const CURRICULUM_TYPES = [
  { value: "NON_DENOMINATIONAL", label: "Non-Denominational", aliases: ["standard"] },
  { value: "NON_DENOMINATIONAL_CHRISTIAN", label: "Non-Denominational Christian", aliases: ["faith based", "faith-based", "faithbased"] },
  { value: "OTHER", label: "Other", aliases: [] },
];

const key = (v) => String(v ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");

/**
 * The curriculum type values in `input` (an array, or text like
 * "Non-Denominational, Other" from an import), in the standard order.
 * Accepts values, labels and the Standard / Faith Based names.
 */
export function normalizeCurriculumTypes(input) {
  const parts = Array.isArray(input) ? input : String(input ?? "").split(/[,;|/]+/);
  const wanted = new Set(parts.map(key).filter(Boolean));
  return CURRICULUM_TYPES.filter(
    (t) => wanted.has(key(t.value)) || wanted.has(key(t.label)) || t.aliases.some((a) => wanted.has(key(a))),
  ).map((t) => t.value);
}

/** Text that isn't a curriculum type, for import warnings. */
export function unknownCurriculumTypes(input) {
  const parts = String(input ?? "").split(/[,;|/]+/).map((p) => p.trim()).filter(Boolean);
  return parts.filter((p) => !normalizeCurriculumTypes([p]).length);
}

export function curriculumTypeLabels(values) {
  return CURRICULUM_TYPES.filter((t) => (values || []).includes(t.value)).map((t) => t.label).join(", ");
}
