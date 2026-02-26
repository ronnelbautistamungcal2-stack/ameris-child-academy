import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherCanAccessClass } from "@/lib/teacherScope";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { id, format = "json" } = req.query;

  const child = await prisma.child.findUnique({
    where: { id },
    include: {
      center: { select: { name: true, address: true } },
      classRoom: { select: { name: true, ageRange: true } },
      parent: { select: { name: true, email: true } },
      guardians: {
        include: { guardian: { select: { name: true, email: true } } },
      },
      progress: {
        include: {
          lesson: { include: { category: true } },
          lessonGoal: true,
          entries: {
            orderBy: { occurredAt: "desc" },
            take: 5,
            include: { recordedBy: { select: { name: true } } },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { recordedBy: { select: { name: true } } },
      },
      attendances: {
        orderBy: { day: "desc" },
        take: 365,
      },
      formSubmissions: {
        include: { template: true },
      },
      behaviorPlans: {
        include: { goals: true },
      },
    },
  });

  if (!child) return res.status(404).json({ error: "Child not found" });

  if (session.user.role === "TEACHER") {
    const hasAccess = await teacherCanAccessClass(session.user.id, child.classRoomId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  const childName = `${child.firstName} ${child.lastName || ""}`.trim();

  const transferRecord = {
    exportVersion: "2.0",
    exportType: "transfer-record",
    exportedAt: new Date().toISOString(),
    child: {
      firstName: child.firstName,
      lastName: child.lastName,
      birthDate: child.birthDate,
      emergencyContact: child.emergencyContact,
      allergies: child.allergies,
      healthAssessmentDocuments: child.healthAssessmentDocuments,
      enrollmentDocuments: child.enrollmentDocuments,
      feedingPlan: child.feedingPlan,
    },
    center: { name: child.center?.name, address: child.center?.address },
    classroom: { name: child.classRoom?.name, ageRange: child.classRoom?.ageRange },
    parent: child.parent ? { name: child.parent.name, email: child.parent.email } : null,
    guardians: child.guardians.map((g) => ({
      name: g.guardian?.name,
      email: g.guardian?.email,
      relationship: g.relationship,
      isPrimary: g.isPrimary,
    })),
    progressRecords: child.progress.map((pr) => ({
      lesson: { title: pr.lesson?.title, category: pr.lesson?.category?.name || null },
      goalIndex: pr.goalIndex,
      goalTitle: pr.lessonGoal?.title || null,
      status: pr.status,
      achievedAt: pr.achievedAt,
      entries: pr.entries.map((e) => ({
        status: e.status,
        notes: e.notes,
        occurredAt: e.occurredAt,
        recordedBy: e.recordedBy?.name || null,
      })),
    })),
    activityLog: child.activities.map((a) => ({
      type: a.type,
      details: a.details,
      notes: a.notes,
      recordedBy: a.recordedBy?.name || null,
      createdAt: a.createdAt,
    })),
    attendanceHistory: child.attendances.map((att) => ({
      day: att.day,
      checkedInAt: att.checkedInAt,
      checkedOutAt: att.checkedOutAt,
      notes: att.notes,
    })),
    formSubmissions: child.formSubmissions.map((fs) => ({
      formTitle: fs.template?.title,
      data: fs.data,
      status: fs.status,
      expiresAt: fs.expiresAt,
      submittedAt: fs.createdAt,
    })),
    behaviorPlans: child.behaviorPlans.map((bp) => ({
      title: bp.title,
      description: bp.description,
      status: bp.status,
      goals: bp.goals.map((g) => ({
        title: g.title,
        domain: g.domain,
        status: g.status,
      })),
    })),
  };

  if (format === "csv") {
    const rows = [
      ["Section", "Field", "Value"],
      ["Child", "Name", childName],
      ["Child", "Birth Date", child.birthDate ? new Date(child.birthDate).toISOString().split("T")[0] : ""],
      ["Child", "Allergies", child.allergies || ""],
      ["Child", "Emergency Contact", child.emergencyContact || ""],
      ["Center", "Name", child.center?.name || ""],
      ["Classroom", "Name", child.classRoom?.name || ""],
    ];

    for (const pr of transferRecord.progressRecords) {
      rows.push(["Progress", pr.lesson?.title || "", `${pr.status} (Goal ${pr.goalIndex})`]);
    }
    for (const a of transferRecord.activityLog.slice(0, 50)) {
      rows.push(["Activity", a.type, a.notes || ""]);
    }
    for (const fs of transferRecord.formSubmissions) {
      rows.push(["Form", fs.formTitle || "", fs.status]);
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="transfer-${childName.replace(/\s+/g, "-")}.csv"`);
    return res.status(200).send(csv);
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="transfer-${childName.replace(/\s+/g, "-")}.json"`);
  return res.status(200).json(transferRecord);
}
