import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";
import {
  attendanceByChildId,
  decorateChildWithTodayAttendance,
  startOfDay,
} from "@/lib/attendance-classroom";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const role = session.user.role;
  if (!["ADMIN", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId } = req.query;
  if (!centerId || typeof centerId !== "string") {
    return res.status(400).json({ error: "centerId is required" });
  }

  if (role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  const day = startOfDay();
  let teacherClassIds = null;

  if (role === "TEACHER") {
    teacherClassIds = await getTeacherClassIds(session.user.id, centerId);
    if (!teacherClassIds.length) {
      return res.status(200).json({
        centerId,
        day: day.toISOString(),
        totalChildren: 0,
        checkedInCount: 0,
        checkedInChildren: [],
        missingChildren: [],
      });
    }
  }

  const [children, records] = await Promise.all([
    prisma.child.findMany({
      where: { centerId },
      select: { id: true, firstName: true, lastName: true, classRoomId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.attendance.findMany({
      where: { centerId, day },
      select: {
        id: true,
        childId: true,
        classRoomId: true,
        checkedInAt: true,
        checkedOutAt: true,
        notes: true,
      },
      take: 2000,
    }),
  ]);

  const byChildId = attendanceByChildId(records);
  const visibleChildren = (role === "TEACHER"
    ? children
        .map((child) =>
          decorateChildWithTodayAttendance(child, byChildId.get(child.id) || null, {
            replaceClassRoomId: true,
          }),
        )
        .filter((child) => teacherClassIds.includes(child.effectiveClassRoomId))
    : children.map((child) =>
        decorateChildWithTodayAttendance(child, byChildId.get(child.id) || null),
      ));

  let checkedInCount = 0;
  const checkedInChildren = [];
  const missingChildren = [];

  for (const child of visibleChildren) {
    const r = byChildId.get(child.id);
    const checkedIn = !!r?.checkedInAt && !r?.checkedOutAt;
    if (checkedIn) {
      checkedInCount += 1;
      checkedInChildren.push({
        child,
        checkedInAt: r.checkedInAt,
      });
    } else {
      missingChildren.push({ child });
    }
  }

  return res.status(200).json({
    centerId,
    day: day.toISOString(),
    totalChildren: visibleChildren.length,
    checkedInCount,
    checkedInChildren,
    missingChildren,
  });
}
