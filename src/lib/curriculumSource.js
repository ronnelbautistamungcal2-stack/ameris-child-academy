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

/** The curriculum source center, or null when none is set. */
export async function curriculumSourceCenter(db = prisma) {
  return db.center.findFirst({
    where: { curriculumSource: true },
    select: { id: true, name: true, subscriberAccountId: true },
    orderBy: { name: "asc" },
  });
}

/** The age groups Ameris offers: the source center's classrooms. */
export async function ageGroupOptions(db = prisma, source) {
  const center = source === undefined ? await curriculumSourceCenter(db) : source;
  if (!center) return [];
  const rooms = await db.classRoom.findMany({
    where: { centerId: center.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rooms;
}

/** Keeps only ids that are age groups (source classrooms), in option order. */
export async function normalizeAgeGroups(input, db = prisma) {
  const wanted = new Set((Array.isArray(input) ? input : []).map(String));
  return (await ageGroupOptions(db)).filter((o) => wanted.has(o.id)).map((o) => o.id);
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
      center: { select: { subscriberAccountId: true, curriculumSource: true } },
    },
  });
  if (!room) return null;
  const source = await curriculumSourceCenter(db);
  const accountId = room.center?.subscriberAccountId || null;
  if (room.center?.curriculumSource || !(await accountUsesAmerisCurriculum(accountId, db, source))) {
    return { mode: "OWN", plannerClassRoomId: room.id, plannerCenterId: room.centerId, types: null };
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
  // One age group on the account: every classroom follows it.
  const ageGroupId =
    room.curriculumAgeGroupId && allowed.has(room.curriculumAgeGroupId)
      ? room.curriculumAgeGroupId
      : ageGroups.length === 1
        ? ageGroups[0].id
        : null;
  return {
    mode: "AMERIS",
    plannerClassRoomId: ageGroupId,
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
  if (!curriculum?.plannerClassRoomId) return out;
  const id = curriculum.plannerClassRoomId;
  const [planner, rows, cells] = await Promise.all([
    db.lessonPlanner.findUnique({ where: { classRoomId: id } }),
    db.lessonPlanRow.findMany({ where: { classRoomId: id } }),
    days.length
      ? db.lessonPlanCell.findMany({
          where: { classRoomId: id, day: { in: days } },
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
