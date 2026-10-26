// Staff training (client mockups 41-Training): the Training Library, Staff
// Training Pathways built from it, and each staff member's progress.
// Shared by the pages and the API.

import { roleLabel } from "@/lib/roles";

export const TRAINING_ROLES = ["TEACHER", "OTHER_STAFF", "KITCHEN_STAFF", "HR_STAFF", "STUDENT_SUPPORT", "COACH", "ADMIN"];
export const TRAINING_ROLE_OPTIONS = TRAINING_ROLES.map((value) => ({ value, label: roleLabel(value) }));

export const TRAINING_AGE_GROUPS = ["Infant (0–12 months)", "Toddler (12–24 months)", "Preschool (2–5 years)", "School Age (6+ years)"];

export const PATHWAY_CATEGORIES = ["Onboarding", "Classroom", "Compliance", "Leadership", "Professional Growth"];
export const TRAINING_CATEGORIES = ["Health & Safety", "Classroom Management", "Child Development", "Nutrition", "Parent Relations", "Regulations", "Education", "Onboarding", "General"];
export const TRAINING_TYPES = [
  { value: "REQUIRED", label: "Required" },
  { value: "OPTIONAL", label: "Optional" },
];
export const TRAINING_SOURCES = ["In-House Training", "Online Course", "External Provider"];
export const MATERIAL_KINDS = [
  { value: "ATTACHMENT", label: "Attachment" },
  { value: "LINK", label: "Link" },
  { value: "VIDEO", label: "Video" },
];

export const PROGRESS_STATUSES = [
  { value: "NOT_STARTED", label: "Not Started", pill: "bg-gray-100 text-gray-700" },
  { value: "IN_PROGRESS", label: "In Progress", pill: "bg-amber-100 text-amber-800" },
  { value: "COMPLETED", label: "Completed", pill: "bg-emerald-100 text-emerald-800" },
];

export function progressLabel(status) {
  return PROGRESS_STATUSES.find((s) => s.value === status)?.label || "Not Started";
}

export function rolesLabel(roles) {
  return roles?.length ? roles.map(roleLabel).join(", ") : "All Staff";
}

export function ageGroupsLabel(groups) {
  return groups?.length ? groups.join(", ") : "All Ages";
}

/** Whether a training or pathway applies to someone with these roles (empty = everyone). */
export function appliesTo(record, userRoles = []) {
  const roles = record?.appliesToRoles || [];
  return !roles.length || roles.some((r) => userRoles.includes(r));
}

const text = (value, max) => String(value ?? "").trim().slice(0, max);

function parseMaterials(input) {
  if (input == null) return { value: [] };
  if (!Array.isArray(input)) return { error: "Materials are invalid" };
  const out = [];
  for (const m of input) {
    const kind = String(m?.kind || "").toUpperCase();
    const url = text(m?.url, 2000);
    if (!MATERIAL_KINDS.some((k) => k.value === kind) || !url) return { error: "Each material needs a type and a link or file" };
    out.push({ kind, url, name: text(m?.name, 200) || (kind === "ATTACHMENT" ? "Attachment" : kind === "VIDEO" ? "Video" : "Link") });
  }
  return { value: out };
}

function parseList(input, allowed) {
  const list = Array.isArray(input) ? [...new Set(input.map((v) => String(v)))] : [];
  if (allowed && list.some((v) => !allowed.includes(v))) return { error: "Unknown option" };
  return { value: list };
}

/** Add/Edit Training. Returns { data } or { error }. */
export function parseTrainingItem(body = {}) {
  const title = text(body.title, 200);
  if (!title) return { error: "Training title is required" };
  const category = text(body.category, 100);
  if (!category) return { error: "Category is required" };
  const description = text(body.description, 500);
  if (!description) return { error: "Description is required" };
  const type = body.type === "OPTIONAL" ? "OPTIONAL" : "REQUIRED";
  const roles = parseList(body.appliesToRoles, TRAINING_ROLES);
  if (roles.error) return { error: "Choose the roles this training applies to" };
  const ages = parseList(body.ageGroups);
  const materials = parseMaterials(body.materials);
  if (materials.error) return materials;
  let dueDate = null;
  if (body.dueDate) {
    dueDate = new Date(`${String(body.dueDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(dueDate.getTime())) return { error: "Due date is invalid" };
  }
  let hours = null;
  if (body.hours !== undefined && body.hours !== null && body.hours !== "") {
    hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 200) return { error: "Hours must be between 0 and 200" };
  }
  return {
    data: {
      title,
      category,
      description,
      type,
      appliesToRoles: roles.value,
      ageGroups: ages.value.map((v) => text(v, 60)).filter(Boolean),
      dueDate,
      hours,
      observationRequired: body.observationRequired === true,
      handsOnRequired: body.handsOnRequired === true,
      materials: materials.value,
    },
  };
}

/** Add/Edit Training Pathway. Age groups are optional (client note N157). */
export function parsePathway(body = {}) {
  const title = text(body.title, 200);
  if (!title) return { error: "Pathway name is required" };
  const category = text(body.category, 100);
  if (!category) return { error: "Category is required" };
  const description = text(body.description, 500);
  if (!description) return { error: "Description is required" };
  const roles = parseList(body.appliesToRoles, TRAINING_ROLES);
  if (roles.error) return { error: "Choose the roles this pathway applies to" };
  const ages = parseList(body.ageGroups);
  const materials = parseMaterials(body.materials);
  if (materials.error) return materials;
  return {
    data: {
      title,
      category,
      description,
      appliesToRoles: roles.value,
      ageGroups: ages.value.map((v) => text(v, 60)).filter(Boolean),
      materials: materials.value,
      active: body.active !== false,
    },
  };
}

/** A staff member's progress on a pathway's trainings. */
export function pathwayProgress(itemIds, progressByItem) {
  const total = itemIds.length;
  const rows = itemIds.map((id) => progressByItem[id]).filter(Boolean);
  const completed = rows.filter((p) => p.status === "COMPLETED").length;
  const started = rows.some((p) => p.status !== "NOT_STARTED");
  const last = rows.map((p) => new Date(p.updatedAt).getTime()).filter(Boolean);
  return {
    total,
    completed,
    pct: total ? Math.round((completed * 100) / total) : 0,
    status: total && completed === total ? "COMPLETED" : started || completed ? "IN_PROGRESS" : "NOT_STARTED",
    lastActivity: last.length ? new Date(Math.max(...last)) : null,
  };
}
