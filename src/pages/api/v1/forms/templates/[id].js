import { getSession } from "@/lib/auth";
import {
  normalizeAssignmentType,
  normalizeStaffRoles,
  targetRoleForAssignment,
} from "@/lib/formAssignments";
import prisma from "@/lib/prisma";

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
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  if (req.method === "GET") {
    const template = await prisma.formTemplate.findUnique({
      where: { id },
    });
    if (!template) return res.status(404).json({ error: "Form template not found" });
    return res.status(200).json(template);
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const existing = await prisma.formTemplate.findUnique({
      where: { id },
      select: { id: true, assignmentType: true, staffRoles: true },
    });
    if (!existing) return res.status(404).json({ error: "Form template not found" });

    const {
      title,
      description,
      targetRole,
      schema,
      centerId,
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
    const data = {};

    if (typeof title === "string") data.title = title;
    if (typeof description === "string" || description === null) data.description = description;
    if (typeof targetRole === "string") data.targetRole = targetRole;
    if (schema !== undefined) data.schema = schema;
    if (centerId === null || typeof centerId === "string") data.centerId = centerId;
    if (typeof active === "boolean") data.active = active;
    if (typeof requiresRenewal === "boolean") data.requiresRenewal = requiresRenewal;
    if (renewalPeriodDays !== undefined) {
      data.renewalPeriodDays = renewalPeriodDays ? parseInt(renewalPeriodDays, 10) : null;
    }
    if (autoFillMapping !== undefined) data.autoFillMapping = autoFillMapping;
    if (attachmentUrl !== undefined) data.attachmentUrl = attachmentUrl || null;
    if (attachmentName !== undefined) data.attachmentName = attachmentName || null;
    if (dueDate !== undefined) data.dueDate = parseDueDate(dueDate);
    if (attachmentSize !== undefined) {
      data.attachmentSize = Number.isFinite(Number(attachmentSize)) ? Number(attachmentSize) : null;
    }

    if (assignmentType !== undefined) {
      const assignment = normalizeAssignmentType(assignmentType);
      const roles = normalizeStaffRoles(staffRoles ?? existing.staffRoles);
      if (assignment === "STAFF" && !roles.length) {
        return res.status(400).json({ error: "Select at least one staff role for a staff assignment" });
      }

      const minMonths = parseAgeMonths(ageMinMonths);
      const maxMonths = parseAgeMonths(ageMaxMonths);
      if (minMonths !== null && maxMonths !== null && minMonths > maxMonths) {
        return res.status(400).json({ error: "Minimum age cannot be greater than maximum age" });
      }

      data.assignmentType = assignment;
      data.ageMinMonths = assignment === "AGE_GROUP" ? minMonths : null;
      data.ageMaxMonths = assignment === "AGE_GROUP" ? maxMonths : null;
      data.staffRoles = assignment === "STAFF" ? roles : null;
      // Keep the visibility role aligned with the new assignment.
      data.targetRole = targetRoleForAssignment(assignment, roles);
    }

    const updated = await prisma.formTemplate.update({
      where: { id },
      data,
    });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const existing = await prisma.formTemplate.findUnique({
      where: { id },
      select: { id: true, _count: { select: { submissions: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Form template not found" });

    // Submissions are the record of what families signed, so never cascade them away.
    if (existing._count.submissions > 0) {
      return res.status(409).json({
        error: "This form has submissions and cannot be deleted. Deactivate it instead.",
      });
    }

    await prisma.formTemplate.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
  res.status(405).end();
}
