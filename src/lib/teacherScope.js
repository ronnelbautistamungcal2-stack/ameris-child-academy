import prisma from "@/lib/prisma";

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

export function teacherChildFilter(teacherId) {
  return {
    classRoom: {
      teachers: {
        some: { teacherId },
      },
    },
  };
}
