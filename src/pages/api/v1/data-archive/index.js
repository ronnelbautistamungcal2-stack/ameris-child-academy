import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId, schoolYear, childId, archiveType } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    if (session.user.role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const where = { centerId };
    if (schoolYear) where.schoolYear = schoolYear;
    if (childId) where.childId = childId;
    if (archiveType) where.archiveType = archiveType;

    const archives = await prisma.dataArchive.findMany({
      where,
      select: {
        id: true,
        centerId: true,
        childId: true,
        childName: true,
        schoolYear: true,
        archiveType: true,
        archivedAt: true,
        archivedById: true,
      },
      orderBy: { archivedAt: "desc" },
    });

    return res.status(200).json(archives);
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create archives" });
    }

    const { centerId, childId, schoolYear, archiveType = "FULL_RECORD" } = req.body;
    if (!centerId || !schoolYear) {
      return res.status(400).json({ error: "centerId and schoolYear are required" });
    }

    const childFilter = childId ? { id: childId, centerId } : { centerId };
    const children = await prisma.child.findMany({
      where: childFilter,
      include: {
        center: { select: { name: true, address: true } },
        classRoom: { select: { name: true, ageRange: true } },
        parent: { select: { name: true, email: true } },
        guardians: { include: { guardian: { select: { name: true, email: true } } } },
        progress: {
          include: {
            lesson: { include: { category: true, goals: { orderBy: { goalIndex: "asc" } } } },
            lessonGoal: true,
            entries: {
              orderBy: { occurredAt: "desc" },
              include: { recordedBy: { select: { id: true, name: true } } },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { recordedBy: { select: { name: true } } },
        },
        attendances: { orderBy: { day: "desc" } },
        formSubmissions: { include: { template: true } },
        behaviorPlans: { include: { goals: true } },
      },
    });

    if (!children.length) return res.status(400).json({ error: "No children found" });

    const created = [];

    for (const child of children) {
      const data = {
        exportVersion: "2.0",
        exportedAt: new Date().toISOString(),
        schoolYear,
        archiveType,
        child: {
          id: child.id,
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
        })),
        progressRecords: child.progress.map((pr) => ({
          lesson: {
            title: pr.lesson?.title,
            description: pr.lesson?.description,
            category: pr.lesson?.category?.name || null,
          },
          goalIndex: pr.goalIndex,
          goalTitle: pr.lessonGoal?.title || null,
          status: pr.status,
          achievedAt: pr.achievedAt,
          createdAt: pr.createdAt,
          entries: pr.entries.map((e) => ({
            status: e.status,
            notes: e.notes,
            media: e.media,
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

      const archive = await prisma.dataArchive.create({
        data: {
          centerId,
          childId: child.id,
          childName: `${child.firstName} ${child.lastName || ""}`.trim(),
          schoolYear,
          archiveType,
          archivedById: session.user.id,
          data,
        },
      });

      created.push(archive);
    }

    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
