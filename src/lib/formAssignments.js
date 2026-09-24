export const FORM_ASSIGNMENT_TYPES = [
  {
    value: "FAMILY",
    label: "Family",
    description: "One copy per family. Parents complete it once for the whole household.",
    targetRole: "PARENT",
  },
  {
    value: "CHILD",
    label: "Child",
    description: "One copy per enrolled child. Parents complete it for each child separately.",
    targetRole: "PARENT",
  },
  {
    value: "AGE_GROUP",
    label: "Age Group",
    description: "Only children whose age falls inside the range below need this form.",
    targetRole: "PARENT",
  },
  {
    value: "STAFF",
    label: "Staff",
    description: "Assigned to staff members in the selected roles.",
    targetRole: "TEACHER",
  },
];

export const FORM_ASSIGNMENT_VALUES = FORM_ASSIGNMENT_TYPES.map((t) => t.value);

export const STAFF_ROLE_OPTIONS = [
  { value: "TEACHER", label: "Teachers" },
  { value: "OTHER_STAFF", label: "Other Staff" },
  { value: "COACH", label: "Coaches" },
  { value: "ADMIN", label: "Admins" },
];

export const STAFF_ROLE_VALUES = STAFF_ROLE_OPTIONS.map((r) => r.value);

export function normalizeAssignmentType(value) {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return FORM_ASSIGNMENT_VALUES.includes(upper) ? upper : "FAMILY";
}

export function assignmentTypeLabel(value) {
  const match = FORM_ASSIGNMENT_TYPES.find((t) => t.value === normalizeAssignmentType(value));
  return match ? match.label : "Family";
}

/** Staff assignments accept a list of roles; everything else is parent-facing. */
export function normalizeStaffRoles(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const entry of value) {
    const upper = typeof entry === "string" ? entry.toUpperCase() : "";
    if (STAFF_ROLE_VALUES.includes(upper)) seen.add(upper);
  }
  return STAFF_ROLE_VALUES.filter((r) => seen.has(r));
}

/**
 * FormTemplate.targetRole still drives who can fetch a template, so keep it in
 * sync with the assignment. Staff templates use the first selected role.
 */
export function targetRoleForAssignment(assignmentType, staffRoles) {
  const type = normalizeAssignmentType(assignmentType);
  if (type !== "STAFF") return "PARENT";
  const roles = normalizeStaffRoles(staffRoles);
  return roles[0] || "TEACHER";
}

export function ageMonthsFromInput(years, months) {
  const y = Number.parseInt(years, 10);
  const m = Number.parseInt(months, 10);
  const total = (Number.isFinite(y) ? y : 0) * 12 + (Number.isFinite(m) ? m : 0);
  if (!Number.isFinite(y) && !Number.isFinite(m)) return null;
  return total >= 0 ? total : null;
}

export function formatAgeMonths(value) {
  if (value === null || value === undefined) return null;
  const total = Number(value);
  if (!Number.isFinite(total) || total < 0) return null;
  const years = Math.floor(total / 12);
  const months = total % 12;
  if (!years) return `${months}mo`;
  if (!months) return `${years}y`;
  return `${years}y ${months}mo`;
}

/** Human-readable summary of who a template is assigned to. */
export function describeAssignment(template) {
  if (!template) return "—";
  const type = normalizeAssignmentType(template.assignmentType);
  if (type === "STAFF") {
    const roles = normalizeStaffRoles(template.staffRoles);
    if (!roles.length) return "Staff";
    const labels = roles.map(
      (r) => STAFF_ROLE_OPTIONS.find((o) => o.value === r)?.label || r,
    );
    return `Staff · ${labels.join(", ")}`;
  }
  if (type === "AGE_GROUP") {
    const min = formatAgeMonths(template.ageMinMonths);
    const max = formatAgeMonths(template.ageMaxMonths);
    if (min && max) return `Age Group · ${min} – ${max}`;
    if (min) return `Age Group · ${min} and older`;
    if (max) return `Age Group · up to ${max}`;
    return "Age Group · any age";
  }
  return assignmentTypeLabel(type);
}

/** Age in whole months, or null when the birth date is missing/invalid. */
export function ageInMonths(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months < 0 ? 0 : months;
}

/** Does this child fall inside an AGE_GROUP template's range? */
export function childMatchesAgeGroup(template, child, now = new Date()) {
  if (normalizeAssignmentType(template?.assignmentType) !== "AGE_GROUP") return true;
  const months = ageInMonths(child?.birthDate, now);
  if (months === null) return false;
  if (template.ageMinMonths !== null && template.ageMinMonths !== undefined && months < template.ageMinMonths) {
    return false;
  }
  if (template.ageMaxMonths !== null && template.ageMaxMonths !== undefined && months > template.ageMaxMonths) {
    return false;
  }
  return true;
}
