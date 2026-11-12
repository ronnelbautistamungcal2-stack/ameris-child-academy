// SOP Tracking on the server: who may assess or track a child, the child's
// steps with their levels, and saving levels (with history entries).

import { accessibleCenterIds, hasAccessToCenter } from "@/lib/auth";
import { accountUsesAmerisCurriculum, curriculumSourceCenter } from "@/lib/curriculumSource";
import prisma from "@/lib/prisma";
import { hasAnyRole, signedInAs } from "@/lib/roles";
import { activeGoalIds, levelForStatus, monthsOld, statusForLevel, stepsForAge } from "@/lib/sop";
import { buildTeacherChildWhere, teacherCanAccessChild } from "@/lib/teacherScope";

export const SOP_ROLES = ["ADMIN", "COACH", "STUDENT_SUPPORT", "TEACHER"];
const GOAL_INDEX = 1;

/** Prisma `where` for the children the user may assess and track, or null. */
export async function sopChildScope(sessionUser, centerId) {
  const user = signedInAs(sessionUser);
  if (hasAnyRole(user, ["ADMIN"])) {
    // Only the admin's own subscriber account (null = no account, all).
    const ids = await accessibleCenterIds(user.id);
    if (!ids) return centerId ? { centerId } : {};
    return { centerId: { in: centerId ? ids.filter((id) => id === centerId) : ids } };
  }
  if (hasAnyRole(user, ["COACH", "STUDENT_SUPPORT"])) {
    // null: someone who is also an admin with no subscriber account, who
    // reaches every center (e.g. an admin signed in as Coach or Student Support).
    const ids = await accessibleCenterIds(user.id);
    if (!ids) return centerId ? { centerId } : {};
    return { centerId: { in: centerId ? ids.filter((id) => id === centerId) : ids } };
  }
  if (hasAnyRole(user, ["TEACHER"])) return buildTeacherChildWhere(user.id, centerId);
  return null;
}

export async function canUseChild(sessionUser, child) {
  if (!child) return false;
  const user = signedInAs(sessionUser);
  if (hasAnyRole(user, ["ADMIN"])) return hasAccessToCenter(user.id, child.centerId);
  if (hasAnyRole(user, ["COACH", "STUDENT_SUPPORT"])) {
    const ids = await accessibleCenterIds(user.id);
    return ids === null || ids.includes(child.centerId);
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

// The steps bank a child's center uses: its own, or for a subscriber the
// Ameris curriculum center's steps of the account's types (step E).
const stepScopes = new WeakMap();
const CENTER_STEPS = (child) => stepScopes.get(child) || { centerId: child.centerId, isStep: true };

/** Prisma `where` for the steps this child is assessed on. */
export async function childStepsWhere(child) {
  await prepareStepScope(child);
  return CENTER_STEPS(child);
}

async function prepareStepScope(child) {
  if (stepScopes.has(child)) return;
  const center = await prisma.center.findUnique({
    where: { id: child.centerId },
    select: { curriculumSource: true, subscriberAccountId: true },
  });
  const source = center?.curriculumSource ? null : await curriculumSourceCenter();
  if (source && (await accountUsesAmerisCurriculum(center?.subscriberAccountId, prisma, source))) {
    const account = await prisma.subscriberAccount.findUnique({
      where: { id: center.subscriberAccountId },
      select: { curriculumTypes: true },
    });
    // No types chosen on the account yet: every Ameris step (client sheet
    // 10-29, row 62: a new subscriber's assessment was empty).
    const types = account?.curriculumTypes || [];
    stepScopes.set(child, { centerId: source.id, isStep: true, ...(types.length ? { types: { hasSome: types } } : {}) });
  } else {
    stepScopes.set(child, { centerId: child.centerId, isStep: true });
  }
}

const PROGRESS_SELECT = { lessonId: true, status: true, active: true, notes: true, assessedAt: true, updatedAt: true };
const ID_BATCH = 10000; // under Postgres's 32,767 bind-parameter limit
const CHAIN_DEPTH = 4; // how far the assessment page follows Not Started / Competency links

function stepRow(s, p) {
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
}

const byReference = (a, b) => (a.reference || "").localeCompare(b.reference || "") || (a.title || "").localeCompare(b.title || "");

/** Every progress row the child has on the center's steps, by step id. */
async function childProgress(child) {
  // A relation filter, not lessonId IN (every step id): a big step bank
  // passes Postgres's 32,767 bind-parameter limit (P2035).
  const rows = await prisma.progress.findMany({
    where: { childId: child.id, goalIndex: GOAL_INDEX, lesson: CENTER_STEPS(child) },
    select: PROGRESS_SELECT,
  });
  return new Map(rows.map((p) => [p.lessonId, p]));
}

async function findInBatches(ids, args) {
  const out = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    out.push(...(await prisma.lesson.findMany({ ...args, where: { ...args.where, id: { in: ids.slice(i, i + ID_BATCH) } } })));
  }
  return out;
}

/**
 * The steps the child has a level on or that are active goals, with that
 * progress. Enough for Progression Tracking, the child profile and the status
 * summaries, without sending a whole step bank (tens of thousands of steps).
 */
export async function loadChildGoals(child) {
  await prepareStepScope(child);
  const progress = await childProgress(child);
  const steps = await findInBatches([...progress.keys()], { where: CENTER_STEPS(child), select: STEP_SELECT });
  return steps.map((s) => stepRow(s, progress.get(s.id))).sort(byReference);
}

/** The step category names for the assessment tabs, General first. */
export async function stepCategoryNames(where) {
  const rows = await prisma.lesson.findMany({
    where: typeof where === "string" ? { centerId: where, isStep: true } : where,
    distinct: ["categoryId"],
    select: { category: { select: { name: true } } },
  });
  const names = [...new Set(rows.map((r) => r.category?.name || "General"))];
  return names.sort((a, b) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)));
}

const LEAN_SELECT = {
  id: true,
  subCategory: true,
  ageYears: true,
  ageMonths: true,
  maxAgeYears: true,
  maxAgeMonths: true,
  priorStepId: true,
  nextStepId: true,
};

/**
 * One tab of the Initial Developmental Assessment: the category's steps the
 * page shows, not the whole bank. By default that is each sub category's
 * steps for the child's age (stepsForAge); with `all` or a search, every step
 * in the category (matching the search). Always added: steps the child has a
 * level on, and the steps up to CHAIN_DEPTH links before and after the shown
 * ones, which the page pulls in when a step is marked Not Started or
 * Competency. Returns { category, tabs, steps }.
 */
export async function loadAssessmentSteps(child, { category, all = false, q = "" } = {}) {
  await prepareStepScope(child);
  const categories = await stepCategoryNames(CENTER_STEPS(child));
  const chosen = categories.includes(category) ? category : categories[0] || null;
  if (!chosen) return { category: null, tabs: categories, steps: [] };

  const inCategory =
    chosen === "General"
      ? { OR: [{ categoryId: null }, { category: { name: "General" } }] }
      : { category: { name: chosen } };
  const search = String(q || "").trim().slice(0, 100);
  const textMatch = search
    ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
    : {};
  const [progress, lean] = await Promise.all([
    childProgress(child),
    prisma.lesson.findMany({ where: { ...CENTER_STEPS(child), AND: [inCategory, textMatch] }, select: LEAN_SELECT }),
  ]);
  const touched = (s) => progress.has(s.id);

  let start;
  if (all || search) {
    start = lean;
  } else {
    const groups = new Map();
    for (const s of lean) {
      const key = s.subCategory || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    const months = monthsOld(child.birthDate);
    start = [...groups.values()].flatMap((list) => stepsForAge(list, months, touched));
  }

  const wanted = new Set(start.map((s) => s.id));
  // Steps the child has a level on in this category stay visible (with a
  // search, the page also matches on notes).
  const leanById = new Map(lean.map((s) => [s.id, s]));
  const touchedInCategory = await findInBatches([...progress.keys()].filter((id) => !leanById.has(id)), {
    where: { ...CENTER_STEPS(child), ...inCategory },
    select: LEAN_SELECT,
  });
  for (const s of touchedInCategory) leanById.set(s.id, s);
  for (const id of progress.keys()) if (leanById.has(id)) wanted.add(id);

  // Follow prior/next links so the page can pull those steps in.
  let frontier = [...wanted];
  for (let depth = 0; depth < CHAIN_DEPTH && frontier.length; depth += 1) {
    const linked = [];
    const missing = [];
    for (const id of frontier) {
      const s = leanById.get(id);
      if (!s) continue;
      for (const next of [s.priorStepId, s.nextStepId]) {
        if (!next || wanted.has(next)) continue;
        wanted.add(next);
        linked.push(next);
        if (!leanById.has(next)) missing.push(next);
      }
    }
    for (const s of await findInBatches(missing, { where: CENTER_STEPS(child), select: LEAN_SELECT })) leanById.set(s.id, s);
    frontier = linked;
  }

  const steps = await findInBatches([...wanted], { where: CENTER_STEPS(child), select: STEP_SELECT });
  return {
    category: chosen,
    tabs: categories,
    steps: steps.map((s) => stepRow(s, progress.get(s.id))).sort(byReference),
  };
}

/**
 * Saves levels ({ stepId, level, notes? }) for a child.
 * mode "assessment": records the levels; with generate, the active goals are
 *   recomputed from every assessed step (Generate Active Goals).
 * mode "tracking": a step reaching Competency or Mastery brings in its next
 *   step as an active goal; a mastered step stops being active.
 */
export async function saveLevels(child, items, user, { mode, generate = false }) {
  await prepareStepScope(child);
  const steps = await prisma.lesson.findMany({
    where: CENTER_STEPS(child),
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
        where: { childId: child.id, goalIndex: GOAL_INDEX, assessedAt: { not: null }, lesson: CENTER_STEPS(child) },
        select: { lessonId: true, status: true },
      });
      const levels = Object.fromEntries(assessed.map((p) => [p.lessonId, levelForStatus(p.status)]));
      const active = activeGoalIds(levels, stepsById);
      await tx.progress.updateMany({ where: { childId: child.id, goalIndex: GOAL_INDEX, lesson: CENTER_STEPS(child) }, data: { active: false } });
      for (const stepId of active) {
        await ensure(stepId, { active: true, ...(levels[stepId] ? {} : { status: "NOT_STARTED" }) });
      }
    }
  });
}
