import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { startOfDay } from "@/lib/attendance-classroom";
import {
  teacherCanAccessChild,
  teacherCanAccessClass,
} from "@/lib/teacherScope";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { childId, targetClassRoomId } = req.body || {};
  if (!childId) {
    return res.status(400).json({ error: "childId is required" });
  }

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: {
      classRoom: { select: { id: true, name: true } },
    },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });

  const day = startOfDay();
  const attendance = await prisma.attendance.findUnique({
    where: { childId_day: { childId, day } },
    select: {
      id: true,
      classRoomId: true,
      checkedInAt: true,
      checkedOutAt: true,
    },
  });

  if (!attendance?.checkedInAt || attendance.checkedOutAt) {
    return res.status(400).json({
      error: "Child must be actively checked in before transferring classrooms.",
    });
  }

  let targetClassRoom = null;
  if (targetClassRoomId) {
    targetClassRoom = await prisma.classRoom.findUnique({
      where: { id: targetClassRoomId },
      select: { id: true, name: true, centerId: true },
    });
    if (!targetClassRoom || targetClassRoom.centerId !== child.centerId) {
      return res.status(400).json({ error: "Target classroom is invalid." });
    }
  }

  if (session.user.role === "TEACHER") {
    const hasCenterScope = await hasAccessToCenter(session.user.id, child.centerId);
    if (!hasCenterScope) return res.status(403).json({ error: "Forbidden" });

    const canAccessCurrent = await teacherCanAccessChild(session.user.id, {
      id: child.id,
      classRoomId: child.classRoomId,
    });
    const canAccessTarget = targetClassRoomId
      ? await teacherCanAccessClass(session.user.id, targetClassRoomId)
      : false;

    if (!canAccessCurrent && !canAccessTarget) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const nextClassRoomId = targetClassRoomId || child.classRoomId || null;
  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: { classRoomId: nextClassRoomId },
    include: {
      classRoom: { select: { id: true, name: true } },
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          classRoomId: true,
        },
      },
    },
  });

  return res.status(200).json({
    ok: true,
    transferred: nextClassRoomId !== (child.classRoomId || null),
    attendance: updated,
    child: {
      ...updated.child,
      defaultClassRoomId: child.classRoomId || null,
      effectiveClassRoomId: nextClassRoomId,
      hasTemporaryClassRoomToday: nextClassRoomId !== (child.classRoomId || null),
    },
  });
}
