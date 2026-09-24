import { getSession, hasAccessToCenter } from "@/lib/auth";
import {
  normalizeAssignmentType,
  normalizeStaffRoles,
  targetRoleForAssignment,
} from "@/lib/formAssignments";
import prisma from "@/lib/prisma";
import { assertSubscriptionFeature } from "@/lib/subscriptions";

function parseDueDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAgeMonths(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;
  const { centerId } = req.query;

  if (req.method === "GET") {
    // Admin sees all; others see templates targeted to their role and accessible centers.
    let where = {};
    if (user.role !== "ADMIN") {
      // A staff assignment can name several roles, so match either the visibility
      // role or the assignment's staffRoles list.
      where = {
        active: true,
        AND: [{ OR: [{ targetRole: user.role }, { staffRoles: { array_contains: [user.role] } }] }],
      };
      if (centerId) {
        if (user.role !== "PARENT") {
          const ok = await hasAccessToCenter(user.id, centerId);
          if (!ok) return res.status(403).json({ error: "Forbidden" });
        }
        const center = await prisma.center.findUnique({
          where: { id: centerId },
          include: { subscription: true },
        });
        if (center?.subscription) {
          try {
            assertSubscriptionFeature(center.subscription, "forms", { centerId });
          } catch (error) {
            return res.status(error.status || 402).json({
              ok: false,
              message: error.message,
              error: {
                code: error.code,
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
              },
            });
          }
        }
        // Include center-specific and global templates for scoped center views.
        where.AND.push({ OR: [{ centerId }, { centerId: null }] });
      }
    } else if (centerId) {
      where = { centerId };
    }

    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.status(200).json(templates);
  }

  if (req.method === "POST") {
    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create form templates" });
    }

    const {
      title,
      description,
      targetRole,
      schema,
      centerId: cId,
      active,
      requiresRenewal,
      renewalPeriodDays,
      autoFillMapping,
      assignmentType,
      ageMinMonths,
      ageMaxMonths,
      staffRoles,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      dueDate,
    } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Callers that only know about targetRole (the older admin Forms page) keep working:
    // a non-parent target role means the form is assigned to staff.
    const assignment = assignmentType
      ? normalizeAssignmentType(assignmentType)
      : targetRole && targetRole !== "PARENT"
        ? "STAFF"
        : "FAMILY";
    const roles = assignmentType
      ? normalizeStaffRoles(staffRoles)
      : normalizeStaffRoles(targetRole ? [targetRole] : []);
    if (assignmentType && assignment === "STAFF" && !roles.length) {
      return res.status(400).json({ error: "Select at least one staff role for a staff assignment" });
    }

    const minMonths = parseAgeMonths(ageMinMonths);
    const maxMonths = parseAgeMonths(ageMaxMonths);
    if (minMonths !== null && maxMonths !== null && minMonths > maxMonths) {
      return res.status(400).json({ error: "Minimum age cannot be greater than maximum age" });
    }

    // targetRole still gates template visibility, so derive it from the assignment.
    const resolvedRole = assignmentType
      ? targetRoleForAssignment(assignment, roles)
      : targetRole || "PARENT";
    if (cId) {
      const center = await prisma.center.findUnique({
        where: { id: cId },
        include: { subscription: true },
      });
      if (center?.subscription) {
        try {
          assertSubscriptionFeature(center.subscription, "forms", { centerId: cId });
        } catch (error) {
          return res.status(error.status || 402).json({
            ok: false,
            message: error.message,
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          });
        }
      }
    }

    const created = await prisma.formTemplate.create({
      data: {
        title,
        description: description || null,
        targetRole: resolvedRole,
        schema: schema ?? null,
        centerId: cId || null,
        active: active ?? true,
        requiresRenewal: requiresRenewal ?? false,
        renewalPeriodDays: requiresRenewal && renewalPeriodDays ? parseInt(renewalPeriodDays) : null,
        autoFillMapping: autoFillMapping ?? null,
        assignmentType: assignment,
        ageMinMonths: assignment === "AGE_GROUP" ? minMonths : null,
        ageMaxMonths: assignment === "AGE_GROUP" ? maxMonths : null,
        staffRoles: assignment === "STAFF" && roles.length ? roles : null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentSize: Number.isFinite(Number(attachmentSize)) ? Number(attachmentSize) : null,
        dueDate: parseDueDate(dueDate),
      },
    });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
