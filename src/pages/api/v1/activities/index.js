import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitActivityLog } from "@/lib/socket";
import { getTeacherClassIds, teacherChildFilter } from "@/lib/teacherScope";

function sameCalendarDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { childId, type } = req.query;

  if (req.method === "GET") {
    // List activity logs for a child
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      if (session.user.role === "PARENT") {
        if (!childId) {
          return res.status(400).json({ error: "childId is required" });
        }
        const child = await prisma.child.findUnique({
          where: { id: childId },
        });
        if (!child || child.parentId !== session.user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const activities = await prisma.activityLog.findMany({
      where: {
        childId: childId || undefined,
        type: type || undefined,
        child:
          session.user.role === "TEACHER"
            ? teacherChildFilter(session.user.id)
            : undefined,
      },
      include: { child: true, recordedBy: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(activities);
  }

  if (req.method === "POST") {
    // Create activity log (teachers/admins only)
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only teachers and admins can log activities" });
    }

    const { childId: cId, type: actType, details, notes, createdAt } = req.body;

    if (!cId || !actType) {
      return res.status(400).json({ error: "childId and type required" });
    }

    if (session.user.role === "TEACHER") {
      const childRecord = await prisma.child.findUnique({
        where: { id: cId },
        select: { id: true, classRoomId: true, centerId: true },
      });
      if (!childRecord) return res.status(404).json({ error: "Child not found" });
      const hasCenterAccess = await hasAccessToCenter(session.user.id, childRecord.centerId);
      if (!hasCenterAccess) return res.status(403).json({ error: "Forbidden" });

      // Fallback behavior:
      // If class assignments exist, enforce class-level access.
      // If no class assignments are configured yet, allow center-level access.
      const classIds = await getTeacherClassIds(session.user.id, childRecord.centerId);
      if (
        classIds.length > 0 &&
        childRecord.classRoomId &&
        !classIds.includes(childRecord.classRoomId)
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    if (createdAt && Number.isNaN(new Date(createdAt).getTime())) {
      return res.status(400).json({ error: "Invalid activity time" });
    }

    const logDate = createdAt ? new Date(createdAt) : new Date();
    const now = new Date();

    if (session.user.role !== "ADMIN") {
      if (!sameCalendarDay(logDate, now)) {
        return res
          .status(403)
          .json({ error: "Teachers can set the activity time for today only" });
      }

      if (logDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        return res.status(400).json({ error: "Activity time cannot be in the future" });
      }
    }

    const isBackdated = !sameCalendarDay(logDate, now);

    const activity = await prisma.activityLog.create({
      data: {
        childId: cId,
        type: actType,
        details: details || null,
        notes,
        recordedById: session.user.id,
        isBackdated,
        createdAt: logDate,
      },
      include: { child: true, recordedBy: true },
    });

    // Get child's center to emit socket event
    const child = await prisma.child.findUnique({ where: { id: cId } });
    if (child) {
      emitActivityLog(child.centerId, activity);
    }

    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
