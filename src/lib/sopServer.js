// SOP Tracking on the server: who may assess or track a child, the child's
// steps with their levels, and saving levels (with history entries).

import { accessibleCenterIds } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { activeGoalIds, levelForStatus, statusForLevel } from "@/lib/sop";
import { buildTeacherChildWhere, teacherCanAccessChild } from "@/lib/teacherScope";

export const SOP_ROLES = ["ADMIN", "COACH", "STUDENT_SUPPORT", "TEACHER"];
const GOAL_INDEX = 1;

/** Prisma `where` for the children the user may assess and track, or null. */
export async function sopChildScope(user, centerId) {
  if (hasAnyRole(user, ["ADMIN"])) return centerId ? { centerId } : {};
  if (hasAnyRole(user, ["COACH", "STUDENT_SUPPORT"])) {
    const ids = (await accessibleCenterIds(user.id)) || [];
    return { centerId: { in: centerId ? ids.filter((id) => id === centerId) : ids } };
  }
  if (hasAnyRole(user, ["TEACHER"])) return buildTeacherChildWhere(user.id, centerId);
  return null;
}

export async function canUseChild(user, child) {
  if (!child) return false;
  if (hasAnyRole(user, ["ADMIN"])) return true;
  if (hasAnyRole(user, ["COACH", "STUDENT_SUPPORT"])) {
    return ((await accessibleCenterIds(user.id)) || []).includes(child.centerId);
  }
  if (hasAnyRole(user, ["TEACHER"])) return teacherCanAccessChild(user.id, child);
  return false;
}

const STEP_SELECT = {
  id: true,
  title: true,
  reference: true,
  description: true,
  subCategory: true,
  ageYears: true,
  ageMonths: true,
  maxAgeYears: true,
  maxAgeMonths: true,
  priorStepId: true,
  nextStepId: true,
  criteria: true,
  category: { select: { name: true } },
};

/** The center's steps and the child's progress on them. */
export async function loadChildSteps(child) {
  const steps = await prisma.lesson.findMany({
    where: { centerId: child.centerId, isStep: true },
    select: STEP_SELECT,
    orderBy: [{ reference: "asc" }, { title: "asc" }],
  });
  const progress = await prisma.progress.findMany({
    where: { childId: child.id, lessonId: { in: steps.map((s) => s.id) }, goalIndex: GOAL_INDEX },
    select: { lessonId: true, status: true, active: true, notes: true, assessedAt: true, updatedAt: true },
  });
  const byStep = Object.fromEntries(progress.map((p) => [p.lessonId, p]));
  return steps.map((s) => {
    const p = byStep[s.id];
    return {
      id: s.id,
      title: s.title,
      reference: s.reference || "",
      question: s.description || "",
      category: s.category?.name || "General",
      subCategory: s.subCategory || "Other",
      ageYears: s.ageYears,
      ageMonths: s.ageMonths,
      maxAgeYears: s.maxAgeYears,
      maxAgeMonths: s.maxAgeMonths,
      priorStepId: s.priorStepId,
      nextStepId: s.nextStepId,
      criteria: s.criteria || null,
      level: p ? levelForStatus(p.status) : null,
      assessed: Boolean(p?.assessedAt),
      active: Boolean(p?.active),
      notes: p?.notes || "",
      updatedAt: p?.updatedAt || null,
    };
  });
}

/**
 * Saves levels ({ stepId, level, notes? }) for a child.
 * mode "assessment": records the levels; with generate, the active goals are
 *   recomputed from every assessed step (Generate Active Goals).
 * mode "tracking": a step reaching Competency or Mastery brings in its next
 *   step as an active goal; a mastered step stops being active.
 */
export async function saveLevels(child, items, user, { mode, generate = false }) {
  const steps = await prisma.lesson.findMany({
    where: { centerId: child.centerId, isStep: true },
    select: { id: true, priorStepId: true, nextStepId: true },
  });
  const stepsById = Object.fromEntries(steps.map((s) => [s.id, s]));
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const ensure = async (stepId, data) => {
      const where = { childId_lessonId_goalIndex: { childId: child.id, lessonId: stepId, goalIndex: GOAL_INDEX } };
      const existing = await tx.progress.findUnique({ where });
      const row = existing
        ? await tx.progress.update({ where: { id: existing.id }, data })
        : await tx.progress.create({ data: { childId: child.id, lessonId: stepId, goalIndex: GOAL_INDEX, ...data } });
      if (data.status && data.status !== existing?.status) {
        await tx.progressEntry.create({ data: { progressId: row.id, status: data.status, notes: data.notes ?? null, recordedById: user.id, details: { source: mode } } });
      }
      return row;
    };

    for (const item of items) {
      const status = statusForLevel(item.level);
      const data = {
        status,
        achievedAt: status === "PASSED" ? now : null,
        ...(mode === "assessment" ? { assessedAt: now } : {}),
        ...(item.notes !== undefined ? { notes: String(item.notes || "").trim().slice(0, 500) || null } : {}),
      };
      if (mode === "tracking") {
        if (item.level === "MASTERY") data.active = false;
        await ensure(item.stepId, data);
        const next = stepsById[item.stepId]?.nextStepId;
        if ((item.level === "COMPETENCY" || item.level === "MASTERY") && next && stepsById[next]) {
          const nextRow = await tx.progress.findUnique({
            where: { childId_lessonId_goalIndex: { childId: child.id, lessonId: next, goalIndex: GOAL_INDEX } },
          });
          if (!nextRow) await ensure(next, { status: "NOT_STARTED", active: true });
          else if (nextRow.status !== "PASSED" && !nextRow.active) await tx.progress.update({ where: { id: nextRow.id }, data: { active: true } });
        }
      } else {
        await ensure(item.stepId, data);
      }
    }

    if (mode === "assessment" && generate) {
      const assessed = await tx.progress.findMany({
        where: { childId: child.id, lessonId: { in: steps.map((s) => s.id) }, goalIndex: GOAL_INDEX, assessedAt: { not: null } },
        select: { lessonId: true, status: true },
      });
      const levels = Object.fromEntries(assessed.map((p) => [p.lessonId, levelForStatus(p.status)]));
      const active = activeGoalIds(levels, stepsById);
      await tx.progress.updateMany({ where: { childId: child.id, lessonId: { in: steps.map((s) => s.id) }, goalIndex: GOAL_INDEX }, data: { active: false } });
      for (const stepId of active) {
        await ensure(stepId, { active: true, ...(levels[stepId] ? {} : { status: "NOT_STARTED" }) });
      }
    }
  });
}
