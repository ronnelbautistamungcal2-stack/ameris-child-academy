// Curriculum plans (client sheet 10-29, rows 3/4): the Lesson Planner is kept
// per age range (Curriculum > Categories > Age Range) and type, instead of
// per classroom. A classroom's own planner still works as before for centers
// that haven't moved to plans.

import { hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { CURRICULUM_TYPES } from "@/lib/curriculumTypes";
import { PLAN_VIEW_ROLES, classroomAccess } from "@/lib/lessonPlanAccess";

/** The Type choices on the planner: every type, or one curriculum type. */
export const PLAN_TYPES = [{ value: "", label: "All types" }, ...CURRICULUM_TYPES.map(({ value, label }) => ({ value, label }))];

export function normalizePlanType(value) {
  const v = String(value ?? "").trim();
  return PLAN_TYPES.some((t) => t.value === v) ? v : null;
}

/** The center's Age Range list (Curriculum > Categories), in a natural order. */
export async function ageRangeNames(centerId, db = prisma) {
  const rows = await db.curriculumOption.findMany({ where: { centerId, kind: "AGE_RANGE" }, select: { name: true } });
  return [...new Set(rows.map((r) => r.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * The plan a classroom or age group follows: for each name in `ageRanges`
 * (first match wins), the plan of one of `types` (in order), else the
 * "All types" plan. Null when there is none.
 */
export async function findPlan(centerId, ageRanges, types = [], db = prisma) {
  const names = [...new Set((ageRanges || []).map((n) => String(n || "").trim()).filter(Boolean))];
  if (!centerId || !names.length) return null;
  const plans = await db.curriculumPlan.findMany({ where: { centerId, ageRange: { in: names, mode: "insensitive" } } });
  for (const name of names) {
    const forName = plans.filter((p) => p.ageRange.toLowerCase() === name.toLowerCase());
    if (!forName.length) continue;
    for (const type of types || []) {
      const hit = forName.find((p) => p.type === type);
      if (hit) return hit;
    }
    return forName.find((p) => p.type === "") || (types?.length ? null : forName[0]);
  }
  return null;
}

/** Checks the user may read (or, with admin, change) this plan. { plan } or { status, error }. */
export async function planAccess(user, centerId, planId, { admin = false } = {}) {
  if (!centerId || !planId) return { status: 400, error: "centerId and planId are required" };
  if (admin ? !hasAnyRole(user, ["ADMIN"]) : !hasAnyRole(user, PLAN_VIEW_ROLES)) {
    return { status: 403, error: admin ? "Only admins can change the curriculum" : "Forbidden" };
  }
  if (!(await hasAccessToCenter(user.id, centerId))) return { status: 403, error: "Forbidden" };
  const plan = await prisma.curriculumPlan.findFirst({ where: { id: String(planId), centerId: String(centerId) } });
  if (!plan) return { status: 404, error: "Plan not found" };
  return { plan };
}

/**
 * What a planner request is about: a curriculum plan (?planId=) or a
 * classroom's own planner (?classRoomId=). Returns { target } or { status, error }.
 * target: { field: "planId" | "classRoomId", id, centerId, plan? }
 */
export async function plannerTarget(user, src, { admin = false } = {}) {
  if (src?.planId) {
    const a = await planAccess(user, src.centerId, src.planId, { admin });
    if (a.error) return a;
    return { target: { field: "planId", id: a.plan.id, centerId: a.plan.centerId, plan: a.plan } };
  }
  const a = await classroomAccess(user, src?.centerId, src?.classRoomId, { admin });
  if (a.error) return a;
  return { target: { field: "classRoomId", id: a.classRoom.id, centerId: a.classRoom.centerId } };
}

/** The planner's theme and day count: on the plan, or the classroom's LessonPlanner row. */
export async function plannerMeta(target, db = prisma) {
  if (target.field === "planId") {
    const plan = await db.curriculumPlan.findUnique({ where: { id: target.id } });
    return { theme: plan?.theme || "", dayCount: plan?.dayCount || 10 };
  }
  const planner = await db.lessonPlanner.upsert({
    where: { classRoomId: target.id },
    create: { classRoomId: target.id, centerId: target.centerId },
    update: {},
  });
  return { theme: planner.theme || "", dayCount: planner.dayCount };
}

export async function updatePlannerMeta(target, data, db = prisma) {
  if (target.field === "planId") return db.curriculumPlan.update({ where: { id: target.id }, data });
  return db.lessonPlanner.update({ where: { classRoomId: target.id }, data });
}

/** Prisma unique key for a cell or row of this target. */
export function cellKey(target, at) {
  return target.field === "planId"
    ? { planId_day_rowIndex: { planId: target.id, ...at } }
    : { classRoomId_day_rowIndex: { classRoomId: target.id, ...at } };
}

export function rowKey(target, rowIndex) {
  return target.field === "planId"
    ? { planId_rowIndex: { planId: target.id, rowIndex } }
    : { classRoomId_rowIndex: { classRoomId: target.id, rowIndex } };
}
