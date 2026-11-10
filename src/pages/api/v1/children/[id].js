import { getSession, hasAccessToCenter } from "@/lib/auth";
import { changeStamps, profileTabData } from "@/lib/childProfile";
import prisma from "@/lib/prisma";
import {
  decorateChildWithTodayAttendance,
  startOfDay,
} from "@/lib/attendance-classroom";
import {
  buildLegacyEmergencyContact,
  normalizeEmergencyContacts,
  normalizeParentContacts,
} from "@/lib/child-contacts";
import {
  applyLinkedParentAccountIds,
  isChildLinkedToParent,
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

async function attachTodayClassroom(child, role) {
  if (!child) return null;
  const todayAttendance = await prisma.attendance.findUnique({
    where: {
      childId_day: {
        childId: child.id,
        day: startOfDay(),
      },
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

  return decorateChildWithTodayAttendance(child, todayAttendance, {
    replaceClassRoomId: role === "TEACHER",
  });
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  // Staff reach only children in their own centers (a parent is checked
  // against their own children below).
  if (session.user.role !== "PARENT") {
    const found = await prisma.child.findUnique({ where: { id: String(id) }, select: { centerId: true } });
    if (!found) return res.status(404).json({ error: "Child not found" });
    if (!(await hasAccessToCenter(session.user.id, found.centerId))) return res.status(404).json({ error: "Child not found" });
  }

  if (req.method === "GET") {
    const child = await prisma.child.findUnique({
      where: { id },
      include: {
        progress: { include: { lesson: true } },
        activities: true,
        ...linkedParentAccountsInclude,
      },
    });
    if (!child) return res.status(404).json({ error: "Child not found" });

    // Parent can only see their own child
    if (
      session.user.role === "PARENT" &&
      !isChildLinkedToParent(child, session.user.id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(await attachTodayClassroom(child, session.user.role));
  }

  if (req.method === "PUT") {
    // Teachers only view a student's profile (client request 07-02, B34).
    // Coaches edit the Student List like admins (R24, client 2026-11-10).
    if (!["ADMIN", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      firstName,
      lastName,
      birthDate,
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

    const normalizedParentContacts = normalizeParentContacts(parentContacts);
    const normalizedEmergencyContacts = normalizeEmergencyContacts(emergencyContacts);
    const legacyEmergencyContact =
      buildLegacyEmergencyContact(normalizedEmergencyContacts) ||
      (typeof emergencyContact === "string" && emergencyContact.trim()
        ? emergencyContact.trim()
        : null);

    const requestedParentAccountIds = Object.prototype.hasOwnProperty.call(
      req.body,
      "parentAccountIds",
    )
      ? parentAccountIds
      : Object.prototype.hasOwnProperty.call(req.body, "parentId")
        ? [parentId]
        : undefined;

    let resolvedParentAccountIds;
    if (requestedParentAccountIds !== undefined) {
      try {
        const current = await prisma.child.findUnique({
          where: { id },
          select: { parentId: true, guardians: { select: { guardianId: true } } },
        });
        resolvedParentAccountIds = await resolveLinkedParentAccountIds(
          prisma,
          requestedParentAccountIds,
          { alreadyLinked: [current?.parentId, ...(current?.guardians || []).map((g) => g.guardianId)] },
        );
      } catch (error) {
        return res.status(400).json({
          error: error?.message || "Invalid linked parent accounts",
        });
      }
    }

    const existing = await prisma.child.findUnique({ where: { id }, select: { feedingPlan: true, allergies: true } });
    if (!existing) return res.status(404).json({ error: "Child not found" });
    const tabData = profileTabData(req.body, existing);
    const has = (key) => Object.prototype.hasOwnProperty.call(req.body, key);
    const stamps = changeStamps(existing, {
      allergies: "allergies" in tabData ? tabData.allergies : has("allergies") ? (typeof allergies === "string" && allergies.trim()) || null : undefined,
      feedingPlan: "feedingPlan" in tabData ? tabData.feedingPlan : has("feedingPlan") ? normalizeFeedingPlan(feedingPlan) : undefined,
    });

    const child = await prisma.$transaction(async (tx) => {
      await tx.child.update({
        where: { id },
        data: {
          firstName,
          lastName,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          classRoomId,
          parentId:
            resolvedParentAccountIds !== undefined
              ? resolvedParentAccountIds[0] || null
              : undefined,
          parentContacts: Object.prototype.hasOwnProperty.call(
            req.body,
            "parentContacts",
          )
            ? normalizedParentContacts
            : undefined,
          emergencyContacts: Object.prototype.hasOwnProperty.call(
            req.body,
            "emergencyContacts",
          )
            ? normalizedEmergencyContacts
            : undefined,
          emergencyContact: Object.prototype.hasOwnProperty.call(
            req.body,
            "emergencyContact",
          )
            ? typeof emergencyContact === "string" && emergencyContact.trim()
              ? emergencyContact.trim()
              : null
            : Object.prototype.hasOwnProperty.call(req.body, "emergencyContacts")
              ? legacyEmergencyContact
              : undefined,
          allergies: Object.prototype.hasOwnProperty.call(req.body, "allergies")
            ? typeof allergies === "string" && allergies.trim()
              ? allergies.trim()
              : null
            : undefined,
          carpool: Object.prototype.hasOwnProperty.call(req.body, "carpool")
            ? typeof carpool === "string" && carpool.trim()
              ? carpool.trim()
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
          iefDocuments: Object.prototype.hasOwnProperty.call(req.body, "iefDocuments")
            ? normalizeDocs(iefDocuments)
            : undefined,
          immunizationDocuments: Object.prototype.hasOwnProperty.call(
            req.body,
            "immunizationDocuments",
          )
            ? normalizeDocs(immunizationDocuments)
            : undefined,
          infantDocuments: Object.prototype.hasOwnProperty.call(req.body, "infantDocuments")
            ? normalizeDocs(infantDocuments)
            : undefined,
          otherDocuments: Object.prototype.hasOwnProperty.call(req.body, "otherDocuments")
            ? normalizeDocs(otherDocuments)
            : undefined,
          feedingPlan: Object.prototype.hasOwnProperty.call(req.body, "feedingPlan")
            ? normalizeFeedingPlan(feedingPlan)
            : undefined,
          enrollmentStartDate: Object.prototype.hasOwnProperty.call(
            req.body,
            "enrollmentStartDate",
          )
            ? enrollmentStartDate
              ? new Date(enrollmentStartDate)
              : null
            : undefined,
          enrollmentEndDate: Object.prototype.hasOwnProperty.call(
            req.body,
            "enrollmentEndDate",
          )
            ? enrollmentEndDate
              ? new Date(enrollmentEndDate)
              : null
            : undefined,
          // Edit Child tabs; last so the synced allergies / feeding plan win.
          ...tabData,
          ...stamps,
        },
      });

      if (resolvedParentAccountIds !== undefined) {
        await applyLinkedParentAccountIds(tx, id, resolvedParentAccountIds);
      }

      return tx.child.findUnique({
        where: { id },
        include: {
          progress: true,
          activities: true,
          ...linkedParentAccountsInclude,
        },
      });
    });

    return res.status(200).json(await attachTodayClassroom(child, session.user.role));
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
        await tx.timeSheetAudit.deleteMany({ where: { kind: "child", childId: id } });
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
