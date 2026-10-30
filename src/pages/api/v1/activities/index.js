import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitActivityLog, emitNotification } from "@/lib/socket";
import {
  buildTeacherChildWhere,
  teacherCanAccessChild,
} from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import { displayName } from "@/lib/ipp";
import { IPP_MANAGER_ROLES, loadIppForUser } from "@/lib/ippAccess";

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
    // Create activity log (teachers, coaches at their centers, admins)
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only teachers, coaches and admins can log activities" });
    }

    const { childId: cId, type: actType, details, notes, createdAt } = req.body;

    if (!cId || !actType) {
      return res.status(400).json({ error: "childId and type required" });
    }

    if (session.user.role === "COACH") {
      const childRecord = await prisma.child.findUnique({ where: { id: cId }, select: { centerId: true } });
      if (!childRecord) return res.status(404).json({ error: "Child not found" });
      if (!(await hasAccessToCenter(session.user.id, childRecord.centerId))) return res.status(403).json({ error: "Forbidden" });
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

    // IPP entries from the Daily Log (client 2026-10-02 sheet 35): a request
    // for a plan, or a log against the child's current plan.
    let ippPlan = null;
    if (actType === "IPP") {
      const kind = details?.kind;
      const text = (key) => String(details?.[key] || "").trim();
      if (kind === "REQUEST") {
        if (!text("primaryConcern")) return res.status(400).json({ error: "Enter the primary concern" });
        if (!text("areaOfConcern")) return res.status(400).json({ error: "Choose the area of concern" });
      } else if (kind === "LOG") {
        const access = await loadIppForUser(session.user, details.planId, { goals: { select: { id: true, title: true } } });
        if (access.error) return res.status(access.status).json({ error: access.error });
        if (!access.canLog) return res.status(403).json({ error: "Only staff can add to the IPP log" });
        if (access.plan.childId !== cId) return res.status(400).json({ error: "That plan belongs to another child" });
        if (details.goalId && !access.plan.goals.some((g) => g.id === details.goalId)) return res.status(400).json({ error: "That goal is not on this plan" });
        if (!text("tactic")) return res.status(400).json({ error: "Enter the tactic used" });
        ippPlan = access.plan;
      } else {
        return res.status(400).json({ error: "Choose Request IPP or Log IPP" });
      }
    }

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
    if (ippPlan) {
      // The entry also goes on the plan's own IPP Log.
      const pad = (n) => String(n).padStart(2, "0");
      const day = `${logDate.getFullYear()}-${pad(logDate.getMonth() + 1)}-${pad(logDate.getDate())}`;
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
      await prisma.behaviorPlanLog.create({
        data: {
          planId: ippPlan.id,
          goalId: details.goalId || null,
          date: new Date(`${day}T00:00:00.000Z`),
          tactic: String(details.tactic).trim().slice(0, 200),
          tacticDetail: details.time ? `Logged at ${details.time} from the Daily Log` : null,
          observation: String(details.observation || "").trim().slice(0, 1000) || null,
          enteredById: session.user.id,
          enteredByName: displayName(me),
        },
      });
    }
    if (child && actType === "IPP" && details.kind === "REQUEST") {
      await notifyIppRequest(child, activity, session.user);
    }
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
            link: `/coach/activity-overrides?childId=${cId}`,
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

/**
 * Request IPP: tell the people who manage plans (admins, and the center's
 * coaches and Student Support) that a teacher asked for one.
 */
async function notifyIppRequest(child, activity, user) {
  const childName = `${child.firstName || ""} ${child.lastName || ""}`.trim() || "A child";
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        { centers: { some: { centerId: child.centerId, role: { in: IPP_MANAGER_ROLES } } } },
      ],
    },
    select: { id: true, role: true },
  }).catch(() => []);
  const notifications = recipients
    .filter((r) => r.id !== user.id)
    .map((r) => ({
      recipientId: r.id,
      type: "COMPLIANCE_ALERT",
      title: "IPP Requested",
      body: `${user.name || user.email || "A teacher"} requested an Individual Progress Plan for ${childName}: ${activity.details?.primaryConcern || ""}`.trim(),
      link: r.role === "STUDENT_SUPPORT" ? `/staff/student-support/progress-plans/new?childId=${child.id}` : `/coach/activity-overrides?childId=${child.id}`,
      metadata: { activityId: activity.id, childId: child.id },
    }));
  if (!notifications.length) return;
  await prisma.notification.createMany({ data: notifications, skipDuplicates: true }).catch(() => {});
  notifications.forEach((n) => emitNotification(n.recipientId, n));
}
