import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

function normalizeDocs(value) {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((d) => (d && typeof d === "object" ? d : null))
    .filter(Boolean)
    .map((d) => ({
      url: typeof d.url === "string" ? d.url : "",
      originalName: typeof d.originalName === "string" ? d.originalName : null,
      mimeType: typeof d.mimeType === "string" ? d.mimeType : null,
      size: Number.isFinite(Number(d.size)) ? Number(d.size) : null,
      uploadedAt: d.uploadedAt ? String(d.uploadedAt) : null,
    }))
    .filter((d) => d.url);
}

function normalizeFeedingPlan(value) {
  if (!value || typeof value !== "object") return null;
  const foods = typeof value.foods === "string" ? value.foods : "";
  const formula = typeof value.formula === "string" ? value.formula : "";
  const bottlesPerDayRaw = value.bottlesPerDay;
  const bottlesPerDay =
    bottlesPerDayRaw === "" ||
    bottlesPerDayRaw === null ||
    bottlesPerDayRaw === undefined
      ? null
      : Number(bottlesPerDayRaw);
  const bottleNotes = typeof value.bottleNotes === "string" ? value.bottleNotes : "";

  return {
    foods: foods.trim() ? foods.trim() : null,
    formula: formula.trim() ? formula.trim() : null,
    bottlesPerDay: Number.isFinite(bottlesPerDay) ? bottlesPerDay : null,
    bottleNotes: bottleNotes.trim() ? bottleNotes.trim() : null,
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const child = await prisma.child.findUnique({
      where: { id },
      include: {
        progress: { include: { lesson: true } },
        activities: true,
        parent: true,
      },
    });
    if (!child) return res.status(404).json({ error: "Child not found" });

    // Parent can only see their own child
    if (session.user.role === "PARENT" && child.parentId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(child);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      firstName,
      lastName,
      birthDate,
      classRoomId,
      parentId,
      emergencyContact,
      allergies,
      healthAssessmentDocuments,
      enrollmentDocuments,
      feedingPlan,
      enrollmentStartDate,
      enrollmentEndDate,
    } = req.body;

    const child = await prisma.child.update({
      where: { id },
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        classRoomId,
        parentId: Object.prototype.hasOwnProperty.call(req.body, "parentId")
          ? parentId || null
          : undefined,
        emergencyContact: Object.prototype.hasOwnProperty.call(req.body, "emergencyContact")
          ? typeof emergencyContact === "string" && emergencyContact.trim()
            ? emergencyContact.trim()
            : null
          : undefined,
        allergies: Object.prototype.hasOwnProperty.call(req.body, "allergies")
          ? typeof allergies === "string" && allergies.trim()
            ? allergies.trim()
            : null
          : undefined,
        healthAssessmentDocuments: Object.prototype.hasOwnProperty.call(
          req.body,
          "healthAssessmentDocuments",
        )
          ? normalizeDocs(healthAssessmentDocuments)
          : undefined,
        enrollmentDocuments: Object.prototype.hasOwnProperty.call(
          req.body,
          "enrollmentDocuments",
        )
          ? normalizeDocs(enrollmentDocuments)
          : undefined,
        feedingPlan: Object.prototype.hasOwnProperty.call(req.body, "feedingPlan")
          ? normalizeFeedingPlan(feedingPlan)
          : undefined,
        enrollmentStartDate: Object.prototype.hasOwnProperty.call(req.body, "enrollmentStartDate")
          ? enrollmentStartDate ? new Date(enrollmentStartDate) : null
          : undefined,
        enrollmentEndDate: Object.prototype.hasOwnProperty.call(req.body, "enrollmentEndDate")
          ? enrollmentEndDate ? new Date(enrollmentEndDate) : null
          : undefined,
      },
      include: { progress: true, activities: true },
    });

    return res.status(200).json(child);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete children" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.outboundEmail.updateMany({
          where: { childId: id },
          data: { childId: null },
        });

        await tx.progressEntry.deleteMany({
          where: { progress: { childId: id } },
        });
        await tx.progress.deleteMany({ where: { childId: id } });
        await tx.activityLog.deleteMany({ where: { childId: id } });
        await tx.attendance.deleteMany({ where: { childId: id } });
        await tx.childTask.deleteMany({ where: { childId: id } });
        await tx.childGuardian.deleteMany({ where: { childId: id } });
        await tx.formSubmission.deleteMany({ where: { childId: id } });
        await tx.milestoneChecklistItemCompletion.deleteMany({
          where: { childId: id },
        });

        await tx.child.delete({ where: { id } });
      });
      return res.status(204).end();
    } catch (e) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Child not found" });
      }
      return res
        .status(500)
        .json({ error: e?.message || "Failed to delete child" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
