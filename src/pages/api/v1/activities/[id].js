import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";
import { teacherCanAccessChild } from "@/lib/teacherScope";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        child: { include: { guardians: { select: { guardianId: true } } } },
        recordedBy: true,
      },
    });

    if (!activity) return res.status(404).json({ error: "Activity not found" });

    // Parent can only see their own child's activities
    if (
      session.user.role === "PARENT" &&
      !isChildLinkedToParent(activity.child, session.user.id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (session.user.role === "TEACHER") {
      const ok = await hasAccessToCenter(session.user.id, activity.child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
      const hasClassAccess = await teacherCanAccessChild(session.user.id, activity.child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(activity);
  }

  if (req.method === "PUT") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can edit activity logs" });
    }

    if (session.user.role === "TEACHER") {
      const ok = await hasAccessToCenter(session.user.id, activity.child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
      const hasClassAccess = await teacherCanAccessChild(session.user.id, activity.child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const { type, notes, details, createdAt } = req.body || {};
    const data = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "type")) data.type = type;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "notes")) data.notes = notes;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "details")) data.details = details;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "createdAt")) {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can change activity dates" });
      }
      const parsed = createdAt ? new Date(createdAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "Invalid activity time" });
      }
      data.createdAt = parsed;
      data.isBackdated = parsed.toDateString() !== new Date().toDateString();
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "No changes submitted" });
    }

    const updated = await prisma.activityLog.update({
      where: { id },
      data,
      include: { child: true, recordedBy: true },
    });

    const effectiveType = data.type || activity.type;
    const wasIpp = !!(activity.details && activity.details.ipp);
    const isIpp = !!(updated.details && updated.details.ipp);
    if (effectiveType === "BEHAVIOR" && isIpp && !wasIpp) {
      const childName = `${updated.child.firstName || ""} ${updated.child.lastName || ""}`.trim() || "A child";
      const admins = await prisma.centerUser.findMany({
        where: { centerId: updated.child.centerId, user: { role: "ADMIN" } },
        select: { userId: true },
      }).catch(() => []);

      if (admins.length > 0) {
        const adminNotifications = admins.map(({ userId }) => ({
          recipientId: userId,
          type: "COMPLIANCE_ALERT",
          title: "IPP Flagged on Course Correction Log",
          body: `${childName}'s Course Correction log was flagged for an Individual Progress Plan (IPP) by ${session.user.name || session.user.email || "a teacher"}.`,
          link: `/admin/activity-overrides?childId=${updated.childId}`,
          metadata: { activityId: updated.id, childId: updated.childId },
        }));
        await prisma.notification.createMany({ data: adminNotifications, skipDuplicates: true }).catch(() => {});
        adminNotifications.forEach((n) => emitNotification(n.recipientId, n));
      }
    }

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can delete activity logs" });
    }

    if (session.user.role === "TEACHER") {
      const ok = await hasAccessToCenter(session.user.id, activity.child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
      const hasClassAccess = await teacherCanAccessChild(session.user.id, activity.child);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.activityLog.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
