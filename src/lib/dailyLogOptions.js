// Daily Log choices shared by the log page and the reports that list the
// entries (Student Performance Report, Class Performance Report).

// Course Correction entries (ActivityLog type BEHAVIOR) record one of these
// and a level from 1 to 4.
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
  return BEHAVIOR_TYPE_OPTIONS.find((o) => o.value === value)?.label || "Course Correction";
}

export function characterHighlightLabel(value) {
  return CHARACTER_HIGHLIGHT_TYPE_OPTIONS.find((o) => o.value === value)?.label || "Character Highlight";
}
