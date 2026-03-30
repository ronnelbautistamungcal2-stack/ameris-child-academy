import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  buildLegacyEmergencyContact,
  normalizeEmergencyContacts,
  normalizeParentContacts,
} from "@/lib/child-contacts";

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

  const { centerId } = req.query;

  // Only admins, teachers, and coaches can view children
  const allowedRoles = ["ADMIN", "TEACHER", "COACH"];
  if (!allowedRoles.includes(session.user.role)) {
    // Parents can only see their own children
    if (session.user.role === "PARENT") {
      const children = await prisma.child.findMany({
        where: { parentId: session.user.id },
      });
      return res.status(200).json(children);
    }
    if (session.user.role === "SUBSCRIBER") {
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id, role: "SUBSCRIBER" },
        select: { centerId: true },
      });
      const centerIds = memberships.map((m) => m.centerId);
      if (!centerIds.length) return res.status(403).json({ error: "Forbidden" });
      const active = await prisma.subscription.findFirst({
        where: { centerId: { in: centerIds }, active: true },
      });
      if (!active) return res.status(402).json({ error: "Subscription inactive" });
      const children = await prisma.child.findMany({
        where: { centerId: centerId ? centerId : { in: centerIds } },
        include: { progress: true, activities: true },
      });
      return res.status(200).json(children);
    }
    return res.status(403).json({ error: "Forbidden" });
  }

  // Teachers/coaches must have access to the center
  if (centerId && session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const children = await prisma.child.findMany({
      where: centerId ? { centerId } : {},
      include: { progress: true, activities: true },
    });
    return res.status(200).json(children);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can create children" });
    }

    const {
      firstName,
      lastName,
      birthDate,
      centerId: cId,
      classRoomId,
      parentId,
      parentContacts,
      emergencyContacts,
      emergencyContact,
      allergies,
      healthAssessmentDocuments,
      enrollmentDocuments,
      feedingPlan,
    } = req.body;
    if (!firstName || !cId) {
      return res.status(400).json({ error: "firstName and centerId required" });
    }

    const normalizedParentContacts = normalizeParentContacts(parentContacts);
    const normalizedEmergencyContacts = normalizeEmergencyContacts(emergencyContacts);
    const legacyEmergencyContact =
      buildLegacyEmergencyContact(normalizedEmergencyContacts) ||
      (typeof emergencyContact === "string" && emergencyContact.trim()
        ? emergencyContact.trim()
        : null);

    const child = await prisma.child.create({
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : null,
        centerId: cId,
        classRoomId,
        parentId,
        parentContacts: normalizedParentContacts,
        emergencyContacts: normalizedEmergencyContacts,
        emergencyContact: legacyEmergencyContact,
        allergies:
          typeof allergies === "string" && allergies.trim()
            ? allergies.trim()
            : null,
        healthAssessmentDocuments: normalizeDocs(healthAssessmentDocuments),
        enrollmentDocuments: normalizeDocs(enrollmentDocuments),
        feedingPlan: normalizeFeedingPlan(feedingPlan),
      },
      include: { progress: true, activities: true },
    });

    return res.status(201).json(child);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
