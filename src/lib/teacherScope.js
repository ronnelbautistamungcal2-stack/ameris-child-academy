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
