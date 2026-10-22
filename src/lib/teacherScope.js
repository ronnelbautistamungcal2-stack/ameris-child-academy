import prisma from "@/lib/prisma";
import { startOfDay } from "@/lib/attendance-classroom";

export async function getTeacherClassIds(teacherId, centerId) {
  if (!teacherId) return [];

  const where = { teacherId };
  if (centerId) {
    where.classRoom = { centerId };
  }

  const rows = await prisma.teacherClass.findMany({
    where,
    select: { classId: true },
  });

  return rows.map((row) => row.classId);
}

/**
 * A teacher's classrooms on one day ("YYYY-MM-DD"): moving them for the day
 * on Staff Attendance replaces their classrooms with the new one (none when
 * moved to Not Assigned).
 */
export async function getTeacherClassIdsForDay(teacherId, centerId, dateKey) {
  const base = await getTeacherClassIds(teacherId, centerId);
  if (!teacherId || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return base;
  const move = await prisma.staffDayMove.findUnique({
    where: { userId_date: { userId: teacherId, date: new Date(`${dateKey}T00:00:00.000Z`) } },
  });
  if (!move || (centerId && move.centerId !== centerId)) return base;
  return move.toClassRoomId ? [move.toClassRoomId] : [];
}

export async function teacherCanAccessClass(teacherId, classId) {
  if (!teacherId || !classId) return false;
  const count = await prisma.teacherClass.count({
    where: { teacherId, classId },
  });
  return count > 0;
}

export async function teacherCanAccessChild(teacherId, childOrId) {
  if (!teacherId || !childOrId) return false;

  const childId = typeof childOrId === "string" ? childOrId : childOrId.id;
  const fallbackClassRoomId =
    typeof childOrId === "object" && childOrId
      ? childOrId.effectiveClassRoomId ?? childOrId.classRoomId ?? null
      : null;

  const day = startOfDay();
  const attendance = childId
    ? await prisma.attendance.findUnique({
        where: { childId_day: { childId, day } },
        select: { classRoomId: true },
      })
    : null;

  const effectiveClassRoomId =
    attendance?.classRoomId ??
    fallbackClassRoomId ??
    (childId
      ? (
          await prisma.child.findUnique({
            where: { id: childId },
            select: { classRoomId: true },
          })
        )?.classRoomId
      : null);

  return teacherCanAccessClass(teacherId, effectiveClassRoomId);
}

export async function buildTeacherChildWhere(teacherId, centerId) {
  const classIds = await getTeacherClassIds(teacherId, centerId);
  if (!classIds.length) {
    return { id: { in: [] } };
  }

  const day = startOfDay();

  return {
    OR: [
      {
        AND: [
          { classRoomId: { in: classIds } },
          {
            attendances: {
              none: {
                day,
                classRoomId: { notIn: classIds },
              },
            },
          },
        ],
      },
      {
        attendances: {
          some: {
            day,
            classRoomId: { in: classIds },
          },
        },
      },
    ],
  };
}

export function teacherChildFilter(teacherId) {
  return {
    classRoom: {
      teachers: {
        some: { teacherId },
      },
    },
  };
}
