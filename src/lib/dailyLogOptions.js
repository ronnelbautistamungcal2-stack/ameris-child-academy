// Daily Log choices shared by the log page and the reports that list the
// entries (Student Performance Report, Class Performance Report).

// Course Correction entries (ActivityLog type BEHAVIOR). Since 2026-10-29
// the Daily Log picks a Character Guide behavior: details.behaviorType is the
// category name, with behaviorId / behaviorName / branch / offense / steps /
// location, and behaviorLevel is the behavior's level. Older entries hold one
// of these codes and the level the teacher chose.
export const BEHAVIOR_TYPE_OPTIONS = [
  { value: "PHYSICAL_VIOLENCE", label: "Physical violence" },
  { value: "VIRTUE", label: "Virtue" },
  { value: "RESPECT", label: "Respect" },
  { value: "OBEDIENCE", label: "Obedience" },
  { value: "HONESTY", label: "Honesty" },
  { value: "OTHER", label: "Other" },
];

export const BEHAVIOR_LEVEL_OPTIONS = ["1", "2", "3", "4"];

// Character Highlight entries (ActivityLog type CHARACTER_HIGHLIGHT).
export const CHARACTER_HIGHLIGHT_TYPE_OPTIONS = [
  { value: "BROTHERS_KEEPER", label: "Brother's Keeper" },
  { value: "CHAMPION_OF_VIRTUE", label: "Champion of Virtue" },
  { value: "FULL_REPENTANCE", label: "Full Repentance" },
  { value: "CHAMPION_OF_OBEDIENCE", label: "Champion of Obedience" },
  { value: "CHAMPION_OF_RESPECT", label: "Champion of Respect" },
  { value: "CHAMPION_OF_HONESTY", label: "Champion of Honesty" },
  { value: "OTHER", label: "Other" },
];

export function behaviorTypeLabel(value) {
  return BEHAVIOR_TYPE_OPTIONS.find((o) => o.value === value)?.label || value || "Course Correction";
}

/**
 * Course Correction types for a report chart: the Character Guide categories
 * plus any older type that appears in the entries ({ type } rows).
 */
export function courseCorrectionTypeOptions(categoryNames = [], entries = []) {
  const options = categoryNames.map((name) => ({ value: name, label: name }));
  const seen = new Set(categoryNames);
  for (const e of entries) {
    const value = e.type || "OTHER";
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: behaviorTypeLabel(value) });
  }
  return options;
}

/** One line describing a Course Correction entry's details. */
export function courseCorrectionSummary(details = {}) {
  const parts = [];
  if (details.behaviorName) parts.push(details.behaviorName);
  else if (details.behaviorType) parts.push(behaviorTypeLabel(details.behaviorType));
  if (details.branchTitle) parts.push(details.branchTitle);
  if (details.offense) parts.push(`Offense ${details.offense}`);
  if (details.location) parts.push(`at ${details.location}`);
  return parts.join(" • ");
}

// IPP entries (ActivityLog type IPP): details.kind REQUEST or LOG.
export const IPP_REQUEST_FIELDS = [
  { key: "primaryConcern", label: "Primary Concern" },
  { key: "areaOfConcern", label: "Area of Concern" },
  { key: "previousSupports", label: "What types of support have previously been attempted to address this concern?" },
  { key: "strengths", label: "What are the student's strengths?" },
];

/** One line describing an IPP entry's details. */
export function ippSummary(details = {}) {
  if (details.kind === "REQUEST") return ["IPP requested", details.primaryConcern, details.areaOfConcern].filter(Boolean).join(" • ");
  return ["IPP log", details.goalTitle, details.tactic, details.observation].filter(Boolean).join(" • ");
}

export function characterHighlightLabel(value) {
  return CHARACTER_HIGHLIGHT_TYPE_OPTIONS.find((o) => o.value === value)?.label || "Character Highlight";
}
