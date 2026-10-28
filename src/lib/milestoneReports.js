// Milestone Progress Report and Child Steps of Progression Report (client
// request 2026-10-23). The world standard age of a step is the average of its
// minimum and maximum age (Steps of Progression Bank); a child "completes" a
// step the first time it is recorded at Competency or Mastery.

import { isDateKey, localDateKey } from "@/lib/foodReports";
import prisma from "@/lib/prisma";
import { enrolledWhere } from "@/lib/reportAccess";

const MONTH_DAYS = 30.44;
const YEAR_DAYS = 365.25;
const round1 = (n) => Math.round(n * 10) / 10;

/** A step's world standard age in years, or null when it has no ages. */
export function worldStandardYears(step) {
  const min = step.ageYears == null && step.ageMonths == null ? null : (step.ageYears || 0) * 12 + (step.ageMonths || 0);
  const max = step.maxAgeYears == null && step.maxAgeMonths == null ? null : (step.maxAgeYears || 0) * 12 + (step.maxAgeMonths || 0);
  if (min == null && max == null) return null;
  const months = min != null && max != null ? (min + max) / 2 : min ?? max;
  return (months * MONTH_DAYS) / YEAR_DAYS;
}

/**
 * Ahead when completed at least 0.1 years (about 5 weeks) before the world
 * standard, Behind when 0.3 years or more after it, otherwise On Track.
 */
export function milestoneStatus(difference) {
  if (difference == null) return null;
  const d = round1(difference);
  if (d <= -0.1) return "AHEAD";
  if (d >= 0.3) return "BEHIND";
  return "ON_TRACK";
}

export const MILESTONE_STATUS_LABELS = { AHEAD: "Ahead", ON_TRACK: "On Track", BEHIND: "Behind", NOT_ACHIEVED: "Not Achieved" };

function ageYears(birthDate, at) {
  if (!birthDate || !at) return null;
  return (new Date(at).getTime() - new Date(birthDate).getTime()) / (YEAR_DAYS * 86400000);
}

/** The center's step categories with their sub categories (report filters). */
async function stepFilters(centerId) {
  const steps = await prisma.lesson.findMany({
    where: { centerId, isStep: true },
    select: { subCategory: true, category: { select: { id: true, name: true, sortOrder: true } } },
  });
  const byId = {};
  for (const s of steps) {
    if (!s.category) continue;
    const c = (byId[s.category.id] ||= { id: s.category.id, name: s.category.name, sortOrder: s.category.sortOrder, subCategories: new Set() });
    if (s.subCategory) c.subCategories.add(s.subCategory);
  }
  return Object.values(byId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, subCategories: [...c.subCategories].sort() }));
}

/** Steps matching the filters whose world standard falls in the age range (months). */
async function loadSteps(centerId, { categoryId, subCategory, minMonths, maxMonths }) {
  const steps = await prisma.lesson.findMany({
    where: { centerId, isStep: true, ...(categoryId ? { categoryId } : {}), ...(subCategory ? { subCategory } : {}) },
    select: {
      id: true,
      title: true,
      subCategory: true,
      ageYears: true,
      ageMonths: true,
      maxAgeYears: true,
      maxAgeMonths: true,
      category: { select: { id: true, name: true, sortOrder: true } },
    },
  });
  return steps
    .map((s) => ({ ...s, world: worldStandardYears(s) }))
    .filter((s) => s.world != null)
    .filter((s) => (minMonths == null || s.world * 12 >= minMonths - 0.01) && (maxMonths == null || s.world * 12 <= maxMonths + 0.01));
}

/** When each child first reached Competency or Mastery on each step, up to the report date. */
async function completions(stepIds, childWhere, reportDate) {
  const rows = await prisma.progress.findMany({
    where: { lessonId: { in: stepIds }, child: childWhere, status: { in: ["COMPLETED", "PASSED"] } },
    select: {
      childId: true,
      lessonId: true,
      achievedAt: true,
      assessedAt: true,
      updatedAt: true,
      child: { select: { birthDate: true } },
      entries: { where: { status: { in: ["COMPLETED", "PASSED"] } }, orderBy: { occurredAt: "asc" }, take: 1, select: { occurredAt: true } },
    },
  });
  const out = [];
  for (const r of rows) {
    const at = r.entries[0]?.occurredAt || r.achievedAt || r.assessedAt || r.updatedAt;
    if (!at || at > reportDate) continue;
    const age = ageYears(r.child.birthDate, at);
    if (age == null || age < 0) continue;
    out.push({ childId: r.childId, stepId: r.lessonId, at, age });
  }
  return out;
}

function groupByCategory(rows) {
  const groups = {};
  for (const row of rows) {
    const key = row.categoryId || "none";
    (groups[key] ||= { id: row.categoryId, name: row.category || "Uncategorized", sortOrder: row.sortOrder ?? 9999, rows: [] }).rows.push(row);
  }
  return Object.values(groups)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(({ sortOrder, ...g }) => ({ ...g, rows: g.rows.sort((a, b) => a.world - b.world || a.title.localeCompare(b.title)).map(({ sortOrder: _s, ...r }) => r) }));
}

function endOfDay(dateKey) {
  return new Date(`${dateKey}T23:59:59.999`);
}

/** Milestone Progress Report: center average age at completion vs. the world standard. */
export async function milestoneProgressReport({ centerId, date, categoryId, subCategory, minMonths, maxMonths, enrolledOnly = false }) {
  const [steps, filters] = await Promise.all([loadSteps(centerId, { categoryId, subCategory, minMonths, maxMonths }), stepFilters(centerId)]);
  const done = await completions(steps.map((s) => s.id), { centerId, ...(enrolledOnly ? enrolledWhere() : {}) }, endOfDay(date));
  const rows = steps.map((s) => {
    const ages = done.filter((d) => d.stepId === s.id).map((d) => d.age);
    const center = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
    const difference = center == null ? null : round1(center) - round1(s.world);
    return {
      id: s.id,
      title: s.title,
      subCategory: s.subCategory || "",
      categoryId: s.category?.id || null,
      category: s.category?.name || "",
      sortOrder: s.category?.sortOrder,
      world: s.world,
      worldYears: round1(s.world),
      centerYears: center == null ? null : round1(center),
      difference: difference == null ? null : round1(difference),
      status: milestoneStatus(difference),
      children: ages.length,
    };
  });
  return {
    date,
    totalChildren: new Set(done.map((d) => d.childId)).size,
    categories: groupByCategory(rows),
    filters,
  };
}

/** Child Steps of Progression Report: the child's age when they completed each step vs. the world standard. */
export async function childStepsReport({ child, date, categoryId, subCategory, minMonths, maxMonths, achieved }) {
  const [steps, filters] = await Promise.all([loadSteps(child.centerId, { categoryId, subCategory, minMonths, maxMonths }), stepFilters(child.centerId)]);
  const done = await completions(steps.map((s) => s.id), { id: child.id }, endOfDay(date));
  const ageNow = ageYears(child.birthDate, endOfDay(date));
  let rows = steps.map((s) => {
    const c = done.find((d) => d.stepId === s.id);
    const difference = c ? round1(c.age) - round1(s.world) : null;
    return {
      id: s.id,
      title: s.title,
      subCategory: s.subCategory || "",
      categoryId: s.category?.id || null,
      category: s.category?.name || "",
      sortOrder: s.category?.sortOrder,
      world: s.world,
      worldYears: round1(s.world),
      childYears: c ? round1(c.age) : null,
      achievedOn: c ? c.at : null,
      difference: difference == null ? null : round1(difference),
      status: c ? milestoneStatus(difference) : "NOT_ACHIEVED",
    };
  });
  if (achieved === "yes") rows = rows.filter((r) => r.childYears != null);
  if (achieved === "no") rows = rows.filter((r) => r.childYears == null);
  return {
    date,
    child: { id: child.id, name: `${child.firstName || ""} ${child.lastName || ""}`.trim(), birthDate: child.birthDate, ageYears: ageNow == null ? null : round1(ageNow) },
    achievedCount: rows.filter((r) => r.childYears != null).length,
    totalSteps: rows.length,
    categories: groupByCategory(rows),
    filters,
  };
}

/** Report filters from the query string. */
export function milestoneParams(query) {
  const num = (v) => (v === undefined || v === "" ? null : Number(v));
  const minMonths = num(query.minMonths);
  const maxMonths = num(query.maxMonths);
  if ([minMonths, maxMonths].some((v) => v != null && (!Number.isFinite(v) || v < 0 || v > 240))) return { error: "Age range is invalid" };
  if (minMonths != null && maxMonths != null && minMonths > maxMonths) return { error: "Age range is invalid" };
  const date = query.date ? String(query.date) : localDateKey(new Date());
  if (!isDateKey(date)) return { error: "Report date is invalid" };
  return {
    date,
    minMonths,
    maxMonths,
    categoryId: query.categoryId ? String(query.categoryId) : null,
    subCategory: query.subCategory ? String(query.subCategory) : null,
    achieved: ["yes", "no"].includes(query.achieved) ? query.achieved : null,
  };
}
