// Which classrooms a user may open a Class Performance Report for (server only).

import { accessibleCenterIds } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";

export const CLASS_REPORT_ROLES = ["ADMIN", "COACH", "STUDENT_SUPPORT", "TEACHER"];

/** Prisma `where` for the classrooms the user can report on, or null. */
export async function classReportScope(user) {
  if (hasAnyRole(user, ["ADMIN"])) return {};
  if (hasAnyRole(user, ["COACH", "STUDENT_SUPPORT"])) {
    return { centerId: { in: (await accessibleCenterIds(user.id)) || [] } };
  }
  if (hasAnyRole(user, ["TEACHER"])) return { teachers: { some: { teacherId: user.id } } };
  return null;
}

export async function findReportableClass(user, classRoomId) {
  const scope = await classReportScope(user);
  if (!scope) return null;
  return prisma.classRoom.findFirst({
    where: { id: String(classRoomId), ...scope },
    select: {
      id: true,
      name: true,
      centerId: true,
      teachers: { select: { teacher: { select: { name: true, email: true } } } },
    },
  });
}
