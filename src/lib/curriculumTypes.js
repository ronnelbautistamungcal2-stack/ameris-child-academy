// Curriculum types (client 2026-11-07): each lesson and step has one or more;
// a subscriber's account lists the types they pay for. Standard is
// Non-Denominational and Faith Based is Non-Denominational Christian. Shared
// by the browser and the server, so no imports.
//
// Since the 10-29 sheet (8), rows 8-10, the list is kept in the
// CurriculumType table (Curriculum > Categories > Types). CURRICULUM_TYPES is
// the starting list, used until the saved one has loaded; every helper takes
// the list to use. Load it with loadCurriculumTypes (server,
// src/lib/curriculumTypesServer.js) or useCurriculumTypes (browser).

/** The type priced as Standard and the one priced as Faith Based (Settings > Subscription Pricing). */
export const STANDARD_TYPE = "NON_DENOMINATIONAL";
export const FAITH_BASED_TYPE = "NON_DENOMINATIONAL_CHRISTIAN";

/** Other names the starting types are known by in step imports. */
export const TYPE_ALIASES = {
  NON_DENOMINATIONAL: ["standard"],
  NON_DENOMINATIONAL_CHRISTIAN: ["faith based", "faith-based", "faithbased"],
};

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
export function normalizeCurriculumTypes(input, types = CURRICULUM_TYPES) {
  const parts = Array.isArray(input) ? input : String(input ?? "").split(/[,;|/]+/);
  const wanted = new Set(parts.map(key).filter(Boolean));
  return types.filter(
    (t) => wanted.has(key(t.value)) || wanted.has(key(t.label)) || (t.aliases || TYPE_ALIASES[t.value] || []).some((a) => wanted.has(key(a))),
  ).map((t) => t.value);
}

/** Text that isn't a curriculum type, for import warnings. */
export function unknownCurriculumTypes(input, types = CURRICULUM_TYPES) {
  const parts = String(input ?? "").split(/[,;|/]+/).map((p) => p.trim()).filter(Boolean);
  return parts.filter((p) => !normalizeCurriculumTypes([p], types).length);
}

export function curriculumTypeLabels(values, types = CURRICULUM_TYPES) {
  return types.filter((t) => (values || []).includes(t.value)).map((t) => t.label).join(", ");
}

/** One type's name, or "" when it isn't on the list. */
export function curriculumTypeLabel(value, types = CURRICULUM_TYPES) {
  return types.find((t) => t.value === value)?.label || "";
}

/**
 * The price column a curriculum type uses: Faith Based for the
 * Non-Denominational Christian type, Standard for every other type (until the
 * client says a new type has its own prices).
 */
export function curriculumVersionForType(type) {
  return type === FAITH_BASED_TYPE ? "FAITH_BASED" : "STANDARD";
}

/** The type a quote saved before types were listed meant (Standard / Faith Based). */
export function typeForCurriculumVersion(version) {
  return version === "FAITH_BASED" ? FAITH_BASED_TYPE : STANDARD_TYPE;
}
