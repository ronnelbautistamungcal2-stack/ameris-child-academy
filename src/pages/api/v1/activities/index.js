import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitActivityLog, emitNotification } from "@/lib/socket";
import {
  buildTeacherChildWhere,
  teacherCanAccessChild,
} from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

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

  const { childId, centerId, type, from, to } = req.query;

  if (req.method === "GET") {
    // List activity logs for a child
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      if (session.user.role === "PARENT") {
        if (!childId) {
          return res.status(400).json({ error: "childId is required" });
        }
        const child = await prisma.child.findUnique({
          where: { id: childId },
          include: { guardians: { select: { guardianId: true } } },
        });
        if (!child || !isChildLinkedToParent(child, session.user.id)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        createdAt.lte = toDate;
      }
    }

    if (centerId && session.user.role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const activities = await prisma.activityLog.findMany({
      where: {
        childId: childId || undefined,
        type: type || undefined,
        createdAt: Object.keys(createdAt).length ? createdAt : undefined,
        child:
          session.user.role === "TEACHER"
            ? await buildTeacherChildWhere(session.user.id, centerId)
            : centerId
              ? { centerId }
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

      const hasChildAccess = await teacherCanAccessChild(session.user.id, childRecord);
      if (!hasChildAccess) {
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

      if (actType === "BEHAVIOR" && details && details.ipp) {
        const childName = `${child.firstName || ""} ${child.lastName || ""}`.trim() || "A child";
        const admins = await prisma.centerUser.findMany({
          where: { centerId: child.centerId, user: { role: "ADMIN" } },
          select: { userId: true },
        }).catch(() => []);

        if (admins.length > 0) {
          const adminNotifications = admins.map(({ userId }) => ({
            recipientId: userId,
            type: "COMPLIANCE_ALERT",
            title: "IPP Flagged on Course Correction Log",
            body: `${childName}'s Course Correction log was flagged for an Individual Progress Plan (IPP) by ${session.user.name || session.user.email || "a teacher"}.`,
            link: `/admin/activity-overrides?childId=${cId}`,
            metadata: { activityId: activity.id, childId: cId },
          }));
          await prisma.notification.createMany({ data: adminNotifications, skipDuplicates: true }).catch(() => {});
          adminNotifications.forEach((n) => emitNotification(n.recipientId, n));
        }
      }
    }

    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
