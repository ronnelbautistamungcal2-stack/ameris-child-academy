const prisma = require("../prisma");
const { emitComplianceAlert, emitNotification } = require("../socket");
const { getClockedInTeacherIds } = require("../compliance");

async function runComplianceAlerts({ centerId = null, initiatedBy = "scheduler" } = {}) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const centerFilter = centerId ? { centerId } : {};

  const existingAlert = await prisma.notification.findFirst({
    where: {
      type: "COMPLIANCE_ALERT",
      createdAt: { gte: todayStart },
      AND: [
        { metadata: { path: ["alertDate"], equals: todayKey } },
        ...(centerId ? [{ metadata: { path: ["centerId"], equals: centerId } }] : []),
      ],
    },
  });

  if (existingAlert) {
    return {
      skipped: true,
      created: 0,
      message: "Alerts already generated for today",
      summary: { missedLogging: 0, missingAttendance: 0, overdueProgress: 0 },
    };
  }

  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(centerId ? { centers: { some: { centerId, role: "TEACHER" } } } : {}),
    },
    select: { id: true },
    take: 200,
  });

  const teacherIds = teachers.map((teacher) => teacher.id);
  const clockedInTeacherIds = await getClockedInTeacherIds({
    teacherIds,
    centerId,
    date: now,
  });
  const eligibleTeachers = teachers.filter((teacher) =>
    clockedInTeacherIds.has(teacher.id),
  );
  const eligibleTeacherIds = eligibleTeachers.map((teacher) => teacher.id);
  const recentLogs = eligibleTeacherIds.length
    ? await prisma.activityLog.groupBy({
        by: ["recordedById"],
        where: {
          recordedById: { in: eligibleTeacherIds },
          createdAt: { gte: last24h },
        },
        _count: true,
      })
    : [];
  const loggedTeachers = new Set(recentLogs.map((row) => row.recordedById));
  const missedCount = eligibleTeachers.filter(
    (teacher) => !loggedTeachers.has(teacher.id),
  ).length;

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

  const overdueCount = await prisma.progress.count({
    where: {
      status: "IN_PROGRESS",
      child: centerId ? { centerId } : {},
      entries: {
        none: { occurredAt: { gte: fourteenDaysAgo } },
      },
    },
  });

  const parts = [];
  if (missedCount > 0) parts.push(`${missedCount} teacher(s) missed daily logging`);
  if (missingAttCount > 0) parts.push(`${missingAttCount} child(ren) missing attendance`);
  if (overdueCount > 0) parts.push(`${overdueCount} progress record(s) overdue (14+ days)`);

  if (!parts.length) {
    return {
      skipped: false,
      created: 0,
      message: "No compliance issues found",
      summary: { missedLogging: missedCount, missingAttendance: missingAttCount, overdueProgress: overdueCount },
    };
  }

  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "COACH"] },
      ...(centerId ? { centers: { some: { centerId } } } : {}),
    },
    select: { id: true },
  });

  const recipientIds = recipients.map((recipient) => recipient.id);
  const prefs = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: recipientIds },
      type: "COMPLIANCE_ALERT",
    },
  });
  const disabledSet = new Set(prefs.filter((pref) => !pref.enabled).map((pref) => pref.userId));
  const alertBody = parts.join("; ");

  const notifications = recipientIds
    .filter((recipientId) => !disabledSet.has(recipientId))
    .map((recipientId) => ({
      recipientId,
      type: "COMPLIANCE_ALERT",
      title: "Compliance Alert",
      body: alertBody,
      link: "/admin/teacher-logging-alerts",
      metadata: {
        alertDate: todayKey,
        centerId,
        initiatedBy,
        missedLogging: missedCount,
        missingAttendance: missingAttCount,
        overdueProgress: overdueCount,
      },
    }));

  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications });
    for (const notification of notifications) {
      emitNotification(notification.recipientId, notification);
    }
  }

  if (centerId) {
    emitComplianceAlert(centerId, {
      alertDate: todayKey,
      missedLogging: missedCount,
      missingAttendance: missingAttCount,
      overdueProgress: overdueCount,
    });
  }

  return {
    skipped: false,
    created: notifications.length,
    message: "Compliance alerts generated",
    summary: { missedLogging: missedCount, missingAttendance: missingAttCount, overdueProgress: overdueCount },
  };
}

module.exports = {
  runComplianceAlerts,
};
