import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNotification, emitComplianceAlert } from "@/lib/socket";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { centerId } = req.body || {};
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD for idempotency
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const centerFilter = centerId ? { centerId } : {};

  // Check idempotency: don't create duplicate alerts for the same day
  const existingAlert = await prisma.notification.findFirst({
    where: {
      type: "COMPLIANCE_ALERT",
      createdAt: { gte: todayStart },
      metadata: { path: ["alertDate"], equals: todayKey },
    },
  });

  if (existingAlert) {
    return res.status(200).json({ message: "Alerts already generated for today", skipped: true });
  }

  // Gather compliance data
  // 1. Missed daily logging
  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(centerId ? { centers: { some: { centerId, role: "TEACHER" } } } : {}),
    },
    select: { id: true, name: true, email: true },
    take: 200,
  });

  const teacherIds = teachers.map((t) => t.id);
  const recentLogs = teacherIds.length
    ? await prisma.activityLog.groupBy({
        by: ["recordedById"],
        where: {
          recordedById: { in: teacherIds },
          createdAt: { gte: last24h },
        },
        _count: true,
      })
    : [];
  const loggedTeachers = new Set(recentLogs.map((l) => l.recordedById));
  const missedCount = teachers.filter((t) => !loggedTeachers.has(t.id)).length;

  // 2. Missing attendance
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  let missingAttCount = 0;
  if (isWeekday) {
    const totalChildren = await prisma.child.count({
      where: { ...centerFilter, classRoomId: { not: null } },
    });
    const checkedIn = await prisma.attendance.count({
      where: { ...centerFilter, day: todayStart },
    });
    missingAttCount = Math.max(0, totalChildren - checkedIn);
  }

  // 3. Overdue progress
  const overdueCount = await prisma.progress.count({
    where: {
      status: "IN_PROGRESS",
      child: centerFilter.centerId ? { centerId: centerFilter.centerId } : {},
      entries: {
        none: { occurredAt: { gte: fourteenDaysAgo } },
      },
    },
  });

  // Build alert summary
  const parts = [];
  if (missedCount > 0) parts.push(`${missedCount} teacher(s) missed daily logging`);
  if (missingAttCount > 0) parts.push(`${missingAttCount} child(ren) missing attendance`);
  if (overdueCount > 0) parts.push(`${overdueCount} progress record(s) overdue (14+ days)`);

  if (parts.length === 0) {
    return res.status(200).json({ message: "No compliance issues found", created: 0 });
  }

  const alertBody = parts.join("; ");

  // Find all admins and coaches to notify
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "COACH"] },
      ...(centerId ? { centers: { some: { centerId } } } : {}),
    },
    select: { id: true },
  });

  // Check preferences
  const recipientIds = recipients.map((r) => r.id);
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: recipientIds }, type: "COMPLIANCE_ALERT" },
  });
  const disabledSet = new Set(prefs.filter((p) => !p.enabled).map((p) => p.userId));

  const notifications = recipientIds
    .filter((id) => !disabledSet.has(id))
    .map((recipientId) => ({
      recipientId,
      type: "COMPLIANCE_ALERT",
      title: "Compliance Alert",
      body: alertBody,
      link: "/admin/teacher-logging-alerts",
      metadata: {
        alertDate: todayKey,
        centerId: centerId || null,
        missedLogging: missedCount,
        missingAttendance: missingAttCount,
        overdueProgress: overdueCount,
      },
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });

    for (const n of notifications) {
      emitNotification(n.recipientId, n);
    }
  }

  // Also emit center-wide compliance alert
  if (centerId) {
    emitComplianceAlert(centerId, {
      alertDate: todayKey,
      missedLogging: missedCount,
      missingAttendance: missingAttCount,
      overdueProgress: overdueCount,
    });
  }

  return res.status(201).json({
    message: "Compliance alerts generated",
    created: notifications.length,
    summary: { missedLogging: missedCount, missingAttendance: missingAttCount, overdueProgress: overdueCount },
  });
}
