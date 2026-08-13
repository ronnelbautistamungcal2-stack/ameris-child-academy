import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  attendanceByChildId,
  decorateChildWithTodayAttendance,
  startOfDay,
} from "@/lib/attendance-classroom";
import { buildTeacherChildWhere } from "@/lib/teacherScope";
import {
  buildLegacyEmergencyContact,
  normalizeEmergencyContacts,
  normalizeParentContacts,
} from "@/lib/child-contacts";
import {
  applyLinkedParentAccountIds,
  buildParentLinkedChildWhere,
  linkedParentAccountsInclude,
  resolveLinkedParentAccountIds,
} from "@/lib/child-parent-links";

function normalizeDocs(value) {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((d) => (d && typeof d === "object" ? d : null))
    .filter(Boolean)
    .map((d) => ({
      url: typeof d.url === "string" && d.url.trim() ? d.url : null,
      originalName: typeof d.originalName === "string" ? d.originalName : null,
      mimeType: typeof d.mimeType === "string" ? d.mimeType : null,
      size: Number.isFinite(Number(d.size)) ? Number(d.size) : null,
      uploadedAt: d.uploadedAt ? String(d.uploadedAt) : null,
      expirationDate: d.expirationDate ? String(d.expirationDate) : null,
      documentType: typeof d.documentType === "string" ? d.documentType : null,
      isManualEntry: Boolean(d.isManualEntry) && !(typeof d.url === "string" && d.url.trim()),
    }))
    .filter(
      (d) =>
        d.url ||
        d.expirationDate ||
        d.originalName ||
        d.documentType,
    );
}

function normalizeFeedingPlan(value) {
  if (!value || typeof value !== "object") return null;
  const foods = typeof value.foods === "string" ? value.foods : "";
  const formula = typeof value.formula === "string" ? value.formula : "";
  const bottlesPerDayRaw = value.bottlesPerDay;
  const bottlesPerDay = bottlesPerDayRaw === "" || bottlesPerDayRaw === null || bottlesPerDayRaw === undefined ? null : Number(bottlesPerDayRaw);
  const bottleNotes = typeof value.bottleNotes === "string" ? value.bottleNotes : "";

  return {
    foods: foods.trim() ? foods.trim() : null,
    formula: formula.trim() ? formula.trim() : null,
    bottlesPerDay: Number.isFinite(bottlesPerDay) ? bottlesPerDay : null,
    bottleNotes: bottleNotes.trim() ? bottleNotes.trim() : null,
  };
}

async function attachTodayClassroom(children, role, centerId) {
  const list = Array.isArray(children) ? children : [];
  if (!list.length) return [];

  const todayAttendance = await prisma.attendance.findMany({
    where: {
      childId: { in: list.map((child) => child.id) },
      day: startOfDay(),
      ...(centerId ? { centerId } : {}),
    },
    select: {
      id: true,
      childId: true,
      classRoomId: true,
      checkedInAt: true,
      checkedOutAt: true,
      notes: true,
      day: true,
    },
  });

  const byChildId = attendanceByChildId(todayAttendance);
  return list.map((child) =>
    decorateChildWithTodayAttendance(child, byChildId.get(child.id) || null, {
      replaceClassRoomId: role === "TEACHER",
    }),
  );
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;

  if (req.method === "GET") {
    // Only admins, teachers, and coaches can view children
    const allowedRoles = ["ADMIN", "TEACHER", "COACH"];
    if (!allowedRoles.includes(session.user.role)) {
      // Parents can only see their own children
      if (session.user.role === "PARENT") {
        const children = await prisma.child.findMany({
          where: buildParentLinkedChildWhere(session.user.id),
          include: linkedParentAccountsInclude,
        });
        return res
          .status(200)
          .json(await attachTodayClassroom(children, session.user.role, centerId));
      }
      // Subscribers: only if active subscription + membership
      if (session.user.role === "SUBSCRIBER") {
        const memberships = await prisma.centerUser.findMany({
          where: { userId: session.user.id, role: "SUBSCRIBER" },
          select: { centerId: true },
        });
        const centerIds = memberships.map((m) => m.centerId);
        if (!centerIds.length) return res.status(403).json({ error: "Forbidden" });
        if (centerId && !centerIds.includes(centerId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const active = await prisma.subscription.findFirst({
          where: { centerId: { in: centerIds }, active: true },
        });
        if (!active) return res.status(402).json({ error: "Subscription inactive" });
        const children = await prisma.child.findMany({
          where: { centerId: centerId ? centerId : { in: centerIds } },
          include: { progress: true, activities: true },
        });
        return res
          .status(200)
          .json(await attachTodayClassroom(children, session.user.role, centerId));
      }
      return res.status(403).json({ error: "Forbidden" });
    }

    // Teachers/coaches must have access to the center
    if (centerId && session.user.role !== "ADMIN") {
      const hasAccess = await hasAccessToCenter(session.user.id, centerId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    let teacherWhere = {};
    if (session.user.role === "TEACHER") {
      teacherWhere = await buildTeacherChildWhere(session.user.id, centerId);
      if (teacherWhere.id?.in && !teacherWhere.id.in.length) {
        return res.status(200).json([]);
      }
    }

    const where = centerId ? { centerId } : {};
    if (session.user.role === "TEACHER") {
      Object.assign(where, teacherWhere);
    }

    const children = await prisma.child.findMany({
      where,
      include: {
        progress: true,
        activities: true,
        ...linkedParentAccountsInclude,
      },
    });
    return res
      .status(200)
      .json(await attachTodayClassroom(children, session.user.role, centerId));
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
      parentAccountIds,
      parentContacts,
      emergencyContacts,
      emergencyContact,
      allergies,
      carpool,
      healthAssessmentDocuments,
      enrollmentDocuments,
      iefDocuments,
      immunizationDocuments,
      infantDocuments,
      otherDocuments,
      feedingPlan,
      enrollmentStartDate,
      enrollmentEndDate,
    } = req.body;
    if (!firstName || !cId) {
      return res.status(400).json({ error: "firstName and centerId required" });
    }
    if (session.user.role === "TEACHER") {
      const hasAccess = await hasAccessToCenter(session.user.id, cId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const requestedParentAccountIds = Object.prototype.hasOwnProperty.call(
      req.body,
      "parentAccountIds",
    )
      ? parentAccountIds
      : Object.prototype.hasOwnProperty.call(req.body, "parentId")
        ? [parentId]
        : [];

    let resolvedParentAccountIds = [];
    try {
      resolvedParentAccountIds = await resolveLinkedParentAccountIds(
        prisma,
        requestedParentAccountIds,
      );
    } catch (error) {
      return res.status(400).json({
        error: error?.message || "Invalid linked parent accounts",
      });
    }

    const normalizedParentContacts = normalizeParentContacts(parentContacts);
    const normalizedEmergencyContacts = normalizeEmergencyContacts(emergencyContacts);
    const legacyEmergencyContact =
      buildLegacyEmergencyContact(normalizedEmergencyContacts) ||
      (typeof emergencyContact === "string" && emergencyContact.trim()
        ? emergencyContact.trim()
        : null);

    const child = await prisma.$transaction(async (tx) => {
      const created = await tx.child.create({
        data: {
          firstName,
          lastName,
          birthDate: birthDate ? new Date(birthDate) : null,
          centerId: cId,
          classRoomId,
          parentId: resolvedParentAccountIds[0] || null,
          parentContacts: normalizedParentContacts,
          emergencyContacts: normalizedEmergencyContacts,
          emergencyContact: legacyEmergencyContact,
          allergies:
            typeof allergies === "string" && allergies.trim()
              ? allergies.trim()
              : null,
          carpool:
            typeof carpool === "string" && carpool.trim()
              ? carpool.trim()
              : null,
          healthAssessmentDocuments: normalizeDocs(healthAssessmentDocuments),
          enrollmentDocuments: normalizeDocs(enrollmentDocuments),
          iefDocuments: normalizeDocs(iefDocuments),
          immunizationDocuments: normalizeDocs(immunizationDocuments),
          infantDocuments: normalizeDocs(infantDocuments),
          otherDocuments: normalizeDocs(otherDocuments),
          feedingPlan: normalizeFeedingPlan(feedingPlan),
          enrollmentStartDate: enrollmentStartDate
            ? new Date(enrollmentStartDate)
            : null,
          enrollmentEndDate: enrollmentEndDate
            ? new Date(enrollmentEndDate)
            : null,
        },
      });

      await applyLinkedParentAccountIds(
        tx,
        created.id,
        resolvedParentAccountIds,
      );

      return tx.child.findUnique({
        where: { id: created.id },
        include: {
          progress: true,
          activities: true,
          ...linkedParentAccountsInclude,
        },
      });
    });

    return res.status(201).json(child);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
