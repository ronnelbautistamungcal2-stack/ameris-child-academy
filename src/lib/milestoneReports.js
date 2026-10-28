// Milestone Progress Report and Child Steps of Progression Report (client
// requests 2026-10-23 and 2026-10-28). The world standard age of a step is the
// average of its minimum and maximum age (Steps of Progression Bank). A child
// reaches Competency the first time the step is recorded at Competency or
// Mastery, and Mastery the first time it is recorded at Mastery. Statuses use
// the SOP Tracking scale: Critical / At Risk / On Track / Ahead / Excelling.

import { isDateKey, localDateKey } from "@/lib/foodReports";
import prisma from "@/lib/prisma";
import { enrolledWhere } from "@/lib/reportAccess";
import { expectedAgeDays, maxExpectedAgeDays, statusForOffset } from "@/lib/sop";

const MONTH_DAYS = 30.44;
const YEAR_DAYS = 365.25;
const DAY = 86400000;
const round1 = (n) => Math.round(n * 10) / 10;
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

/** A step's world standard age in years, or null when it has no ages. */
export function worldStandardYears(step) {
  const min = step.ageYears == null && step.ageMonths == null ? null : (step.ageYears || 0) * 12 + (step.ageMonths || 0);
  const max = step.maxAgeYears == null && step.maxAgeMonths == null ? null : (step.maxAgeYears || 0) * 12 + (step.maxAgeMonths || 0);
  if (min == null && max == null) return null;
  const months = min != null && max != null ? (min + max) / 2 : min ?? max;
  return (months * MONTH_DAYS) / YEAR_DAYS;
}

/** SOP rule: only Competency or Mastery can be Ahead, only Mastery Excelling. */
function capped(status, level) {
  return status === "EXCELLING" && level !== "MASTERY" ? "AHEAD" : status;
}

/**
 * Status against the step's age range, with the SOP thresholds (2 weeks /
 * 1 month). Reached before the minimum age is ahead and after the maximum age
 * is behind; not reached while older than the maximum age is behind.
 */
export function worldStatus(step, level, ageYearsAt) {
  if (ageYearsAt == null) return null;
  const min = expectedAgeDays(step);
  const max = maxExpectedAgeDays(step);
  const age = ageYearsAt * YEAR_DAYS;
  let offset = age > max ? max - age : 0;
  if (level && age < min) offset = min - age;
  return capped(statusForOffset(offset), level);
}

/** Status against the center average age (years) for the same level. */
export function centerStatus(centerYears, level, ageYearsAt) {
  if (centerYears == null || ageYearsAt == null) return null;
  const offset = (centerYears - ageYearsAt) * YEAR_DAYS;
  return capped(statusForOffset(level ? offset : Math.min(0, offset)), level);
}

function ageYears(birthDate, at) {
  if (!birthDate || !at) return null;
  return (new Date(at).getTime() - new Date(birthDate).getTime()) / (YEAR_DAYS * DAY);
}

/** Whole months old on a date. */
function ageMonthsOn(birthDate, at) {
  const b = new Date(birthDate);
  const d = new Date(at);
  let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  if (d.getDate() < b.getDate()) months -= 1;
  return months;
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

/** Steps matching the category filters that have a world standard age. */
async function loadSteps(centerId, { categoryId, subCategory }) {
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
  return steps.map((s) => ({ ...s, world: worldStandardYears(s) })).filter((s) => s.world != null);
}

/**
 * The center's children counted in the averages: born by the report date and,
 * with an age range, that age on the report date (client 2026-10-28).
 */
async function childrenInRange(centerId, reportDate, { minMonths, maxMonths, enrolledOnly = false }) {
  const children = await prisma.child.findMany({
    where: { centerId, birthDate: { not: null, lte: reportDate }, ...(enrolledOnly ? enrolledWhere() : {}) },
    select: { id: true, birthDate: true },
  });
  return children.filter((c) => {
    const months = ageMonthsOn(c.birthDate, reportDate);
    return (minMonths == null || months >= minMonths) && (maxMonths == null || months <= maxMonths);
  });
}

/**
 * When each child first reached Competency and Mastery on each step, up to the
 * report date: [{ childId, stepId, competency: { at, age }, mastery: { at, age } | null }].
 */
async function completions(stepIds, childIds, reportDate) {
  if (!stepIds.length || !childIds.length) return [];
  const rows = await prisma.progress.findMany({
    where: { lessonId: { in: stepIds }, childId: { in: childIds }, status: { in: ["COMPLETED", "PASSED"] } },
    select: {
      childId: true,
      lessonId: true,
      status: true,
      achievedAt: true,
      assessedAt: true,
      updatedAt: true,
      child: { select: { birthDate: true } },
      entries: { where: { status: { in: ["COMPLETED", "PASSED"] } }, orderBy: { occurredAt: "asc" }, select: { status: true, occurredAt: true } },
    },
  });
  const out = [];
  for (const r of rows) {
    const fallback = r.achievedAt || r.assessedAt || r.updatedAt;
    const reach = (at) => {
      if (!at || at > reportDate) return null;
      const age = ageYears(r.child.birthDate, at);
      return age == null || age < 0 ? null : { at, age };
    };
    const competency = reach(r.entries[0]?.occurredAt || fallback);
    if (!competency) continue;
    const mastery = reach(r.entries.find((e) => e.status === "PASSED")?.occurredAt || (r.status === "PASSED" ? fallback : null));
    out.push({ childId: r.childId, stepId: r.lessonId, competency, mastery });
  }
  return out;
}

/** Center average ages (years) at Competency and Mastery for one step. */
function centerAverages(done, stepId) {
  const forStep = done.filter((d) => d.stepId === stepId);
  const competency = forStep.map((d) => d.competency.age);
  const mastery = forStep.filter((d) => d.mastery).map((d) => d.mastery.age);
  return { competency: avg(competency), mastery: avg(mastery), competencyChildren: competency.length, masteryChildren: mastery.length };
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

const years = (n) => (n == null ? null : round1(n));
const stepFields = (s) => ({
  id: s.id,
  title: s.title,
  subCategory: s.subCategory || "",
  categoryId: s.category?.id || null,
  category: s.category?.name || "",
  sortOrder: s.category?.sortOrder,
  world: s.world,
  worldYears: round1(s.world),
});

/**
 * Milestone Progress Report: the center's average age at Competency and at
 * Mastery vs. the world standard. The difference and status use Mastery when
 * any child has reached it, otherwise Competency.
 */
export async function milestoneProgressReport({ centerId, date, categoryId, subCategory, minMonths, maxMonths, enrolledOnly = false }) {
  const reportDate = endOfDay(date);
  const [steps, filters, children] = await Promise.all([
    loadSteps(centerId, { categoryId, subCategory }),
    stepFilters(centerId),
    childrenInRange(centerId, reportDate, { minMonths, maxMonths, enrolledOnly }),
  ]);
  const done = await completions(steps.map((s) => s.id), children.map((c) => c.id), reportDate);
  const rows = steps.map((s) => {
    const c = centerAverages(done, s.id);
    const level = c.mastery != null ? "MASTERY" : c.competency != null ? "COMPETENCY" : null;
    const age = level === "MASTERY" ? c.mastery : c.competency;
    return {
      ...stepFields(s),
      competencyYears: years(c.competency),
      masteryYears: years(c.mastery),
      competencyChildren: c.competencyChildren,
      masteryChildren: c.masteryChildren,
      level,
      difference: age == null ? null : round1(round1(age) - round1(s.world)),
      status: level ? worldStatus(s, level, age) : null,
    };
  });
  return {
    date,
    childrenInRange: children.length,
    totalChildren: new Set(done.map((d) => d.childId)).size,
    categories: groupByCategory(rows),
    filters,
  };
}

/**
 * Child Steps of Progression Report: the child's age at Competency and at
 * Mastery next to the center averages (the center's children in the age range
 * on the report date) and the world standard. Differences and statuses use the
 * child's highest level reached; a step not reached is compared at the child's
 * age on the report date.
 */
export async function childStepsReport({ child, date, categoryId, subCategory, minMonths, maxMonths, competency, mastery }) {
  const reportDate = endOfDay(date);
  const [steps, filters, peers] = await Promise.all([
    loadSteps(child.centerId, { categoryId, subCategory }),
    stepFilters(child.centerId),
    childrenInRange(child.centerId, reportDate, { minMonths, maxMonths }),
  ]);
  const stepIds = steps.map((s) => s.id);
  const [done, peerDone] = await Promise.all([completions(stepIds, [child.id], reportDate), completions(stepIds, peers.map((p) => p.id), reportDate)]);
  const ageNow = ageYears(child.birthDate, reportDate);
  let rows = steps.map((s) => {
    const mine = done.find((d) => d.stepId === s.id);
    const center = centerAverages(peerDone, s.id);
    const level = mine?.mastery ? "MASTERY" : mine ? "COMPETENCY" : null;
    const age = level === "MASTERY" ? mine.mastery.age : level ? mine.competency.age : ageNow;
    const centerAge = level === "MASTERY" ? center.mastery : center.competency;
    return {
      ...stepFields(s),
      competency: mine ? { at: mine.competency.at, years: round1(mine.competency.age) } : null,
      mastery: mine?.mastery ? { at: mine.mastery.at, years: round1(mine.mastery.age) } : null,
      centerCompetencyYears: years(center.competency),
      centerMasteryYears: years(center.mastery),
      level,
      centerDifference: level && centerAge != null ? round1(round1(age) - round1(centerAge)) : null,
      worldDifference: level ? round1(round1(age) - round1(s.world)) : null,
      centerStatus: centerStatus(centerAge, level, age),
      worldStatus: worldStatus(s, level, age),
    };
  });
  if (competency === "yes") rows = rows.filter((r) => r.competency);
  if (competency === "no") rows = rows.filter((r) => !r.competency);
  if (mastery === "yes") rows = rows.filter((r) => r.mastery);
  if (mastery === "no") rows = rows.filter((r) => !r.mastery);
  return {
    date,
    child: { id: child.id, name: `${child.firstName || ""} ${child.lastName || ""}`.trim(), birthDate: child.birthDate, ageYears: ageNow == null ? null : round1(ageNow) },
    competencyCount: rows.filter((r) => r.competency).length,
    masteryCount: rows.filter((r) => r.mastery).length,
    totalSteps: rows.length,
    childrenInRange: peers.length,
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
    competency: ["yes", "no"].includes(query.competency) ? query.competency : null,
    mastery: ["yes", "no"].includes(query.mastery) ? query.mastery : null,
  };
}
