// Ameris Solutions curriculum (client 2026-11-07, step E).
//
// One center is the curriculum source (Center.curriculumSource). Its Lesson
// Bank, Lesson Planner (one planner per classroom = per age group) and Steps
// of Progression Bank belong to Ameris Solutions and are edited from the
// Global admin. Subscribers never get the banks: each subscriber classroom
// follows one of the age groups on its account, and its Lesson Calendar and
// the teacher's weekly plan show that planner's lessons, live, limited to the
// curriculum types the account pays for.
//
// Centers in the account that owns the source center keep working the old
// way (their own planner and banks).

import prisma from "@/lib/prisma";
import { ageRangeNames, findPlan } from "@/lib/curriculumPlans";

/** The curriculum source center, or null when none is set. */
export async function curriculumSourceCenter(db = prisma) {
  return db.center.findFirst({
    where: { curriculumSource: true },
    select: { id: true, name: true, subscriberAccountId: true },
    orderBy: { name: "asc" },
  });
}

/**
 * The age groups Ameris offers: the curriculum center's Age Range list
 * (Curriculum > Categories; client sheet 10-29, row 3). { id, name } with the
 * name as id, so stored choices read as the age group itself.
 */
export async function ageGroupOptions(db = prisma, source) {
  const center = source === undefined ? await curriculumSourceCenter(db) : source;
  if (!center) return [];
  return (await ageRangeNames(center.id, db)).map((name) => ({ id: name, name }));
}

/** Keeps only names that are age groups, in option order. */
export async function normalizeAgeGroups(input, db = prisma) {
  const wanted = new Set((Array.isArray(input) ? input : []).map((v) => String(v).trim().toLowerCase()));
  return (await ageGroupOptions(db)).filter((o) => wanted.has(o.id.toLowerCase())).map((o) => o.id);
}

/**
 * True when the account's own centers use the Ameris curriculum (it is a
 * subscriber), false when the account owns the source center or there is no
 * source center at all.
 */
export async function accountUsesAmerisCurriculum(accountId, db = prisma, source) {
  const center = source === undefined ? await curriculumSourceCenter(db) : source;
  if (!center) return false;
  if (!accountId) return false;
  return center.subscriberAccountId !== accountId;
}

/** Lesson types filter: null = everything, else the account's types. */
export function typeFilter(types) {
  if (types === null || types === undefined) return null;
  return { types: { hasSome: types } };
}

export function lessonMatchesTypes(lesson, types) {
  if (types === null || types === undefined) return true;
  return (lesson?.types || []).some((t) => types.includes(t));
}

/**
 * How a classroom gets its lessons.
 *   { mode: "OWN", plannerClassRoomId, plannerCenterId, types: null }
 *   { mode: "AMERIS", plannerClassRoomId (null until an age group is chosen),
 *     plannerCenterId, types, ageGroups: [{id,name}], ageGroupId }
 */
export async function classroomCurriculum(classRoomId, db = prisma) {
  const room = await db.classRoom.findUnique({
    where: { id: String(classRoomId) },
    select: {
      id: true,
      centerId: true,
      curriculumAgeGroupId: true,
      name: true,
      ageRange: true,
      center: { select: { subscriberAccountId: true, curriculumSource: true } },
    },
  });
  if (!room) return null;
  const source = await curriculumSourceCenter(db);
  const accountId = room.center?.subscriberAccountId || null;
  if (room.center?.curriculumSource || !(await accountUsesAmerisCurriculum(accountId, db, source))) {
    // The center's plan for this classroom's age range (or name); else the
    // classroom's own planner, as before plans existed.
    const plan = await findPlan(room.centerId, [room.ageRange, room.name], [], db);
    return plan
      ? { mode: "OWN", planId: plan.id, plannerClassRoomId: null, plannerCenterId: room.centerId, types: null }
      : { mode: "OWN", planId: null, plannerClassRoomId: room.id, plannerCenterId: room.centerId, types: null };
  }
  const account = await db.subscriberAccount.findUnique({
    where: { id: accountId },
    select: { curriculumTypes: true, curriculumAgeGroups: true },
  });
  const options = await ageGroupOptions(db, source);
  // No age groups chosen on the account yet: offer them all, so a new
  // subscriber can pick one (client sheet 10-29, row 61).
  const chosen = account?.curriculumAgeGroups || [];
  const allowed = new Set(chosen.length ? chosen : options.map((o) => o.id));
  const ageGroups = options.filter((o) => allowed.has(o.id));
  // The classroom's chosen age group; else its own age range when Ameris has
  // it; else the account's only age group.
  const byName = (name) => ageGroups.find((g) => g.id.toLowerCase() === String(name || "").trim().toLowerCase())?.id;
  const ageGroupId = byName(room.curriculumAgeGroupId) || byName(room.ageRange) || (ageGroups.length === 1 ? ageGroups[0].id : null);
  // Ameris's plan for that age group in a type the account has, else "All types".
  const accountTypes = account?.curriculumTypes || [];
  // No types chosen on the account yet: any plan for the age group.
  const plan = ageGroupId ? await findPlan(source.id, [ageGroupId], accountTypes.length ? [...accountTypes, ""] : [], db) : null;
  return {
    mode: "AMERIS",
    planId: plan?.id || null,
    plannerClassRoomId: null,
    plannerCenterId: source.id,
    // No types chosen yet: every lesson (null = no type filter).
    types: account?.curriculumTypes?.length ? account.curriculumTypes : null,
    ageGroups,
    ageGroupId,
    chosenAgeGroupId: room.curriculumAgeGroupId || null,
  };
}

/**
 * The lessons a classroom's planner has on the given day numbers:
 * { rows: [{rowIndex,label}], theme, byDay: { [day]: { [rowIndex]: cell } } }.
 * Cells pointing at a lesson of a type the account doesn't have are left out.
 */
export async function plannedLessons(curriculum, days, { buildActiveRows, rowLabel }, db = prisma) {
  const out = { rows: [], theme: "", byDay: {} };
  const field = curriculum?.planId ? "planId" : "classRoomId";
  const id = curriculum?.planId || curriculum?.plannerClassRoomId;
  if (!id) return out;
  const [planner, rows, cells] = await Promise.all([
    field === "planId" ? db.curriculumPlan.findUnique({ where: { id } }) : db.lessonPlanner.findUnique({ where: { classRoomId: id } }),
    db.lessonPlanRow.findMany({ where: { [field]: id } }),
    days.length
      ? db.lessonPlanCell.findMany({
          where: { [field]: id, day: { in: days } },
          include: { lesson: { select: { id: true, title: true, types: true } } },
        })
      : [],
  ]);
  out.theme = planner?.theme || "";
  out.rows = buildActiveRows(rows).map((row) => ({ rowIndex: row.rowIndex, label: rowLabel(row) }));
  for (const cell of cells) {
    if (cell.lessonId && !lessonMatchesTypes(cell.lesson, curriculum.types)) continue;
    (out.byDay[cell.day] ||= {})[cell.rowIndex] = { title: cell.title, lessonId: cell.lessonId };
  }
  return out;
}
