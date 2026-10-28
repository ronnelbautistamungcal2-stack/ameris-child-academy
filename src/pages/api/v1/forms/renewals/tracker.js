import { getSession } from "@/lib/auth";
import { childMatchesAgeGroup, normalizeAssignmentType } from "@/lib/formAssignments";
import prisma from "@/lib/prisma";

const DAY = 86400000;
const parentName = (child) => child.parent?.name || child.guardians[0]?.guardian?.name || "";

/**
 * GET /api/v1/forms/renewals/tracker[?centerId=]
 * Admin Form Renewals (client mockup 36-02): every currently enrolled child
 * against each form that renews and applies to them, with the current
 * expiration (the latest submission; the form's due date until one is sent),
 * days until due, status (OVERDUE, DUE_SOON within 30 days, CURRENT) and the
 * admin's note.
 * PUT /api/v1/forms/renewals/tracker { templateId, childId, note }
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PUT") {
    const templateId = String(req.body?.templateId || "");
    const childId = String(req.body?.childId || "");
    if (!templateId || !childId) return res.status(400).json({ error: "templateId and childId are required" });
    const note = String(req.body?.note || "").trim().slice(0, 500);
    if (!note) {
      await prisma.formRenewalNote.deleteMany({ where: { templateId, childId } });
      return res.status(200).json({ note: "" });
    }
    const saved = await prisma.formRenewalNote.upsert({
      where: { templateId_childId: { templateId, childId } },
      update: { note, updatedById: session.user.id },
      create: { templateId, childId, note, updatedById: session.user.id },
    });
    return res.status(200).json({ note: saved.note });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  }

  const centerId = req.query.centerId ? String(req.query.centerId) : null;
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const [templates, children] = await Promise.all([
    prisma.formTemplate.findMany({
      where: { active: true, requiresRenewal: true, targetRole: "PARENT", ...(centerId ? { OR: [{ centerId }, { centerId: null }] } : {}) },
      orderBy: { title: "asc" },
    }),
    prisma.child.findMany({
      where: {
        ...(centerId ? { centerId } : {}),
        OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: startOfToday } }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        centerId: true,
        parent: { select: { name: true } },
        guardians: { select: { guardian: { select: { name: true } } } },
      },
      orderBy: [{ firstName: "asc" }],
    }),
  ]);
  const templateIds = templates.map((t) => t.id);
  const childIds = children.map((c) => c.id);
  const [submissions, notes] = await Promise.all([
    prisma.formSubmission.findMany({
      where: { templateId: { in: templateIds }, childId: { in: childIds } },
      select: { id: true, templateId: true, childId: true, expiresAt: true, createdAt: true, data: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formRenewalNote.findMany({ where: { templateId: { in: templateIds }, childId: { in: childIds } } }),
  ]);

  const rows = [];
  for (const template of templates) {
    const type = normalizeAssignmentType(template.assignmentType);
    for (const child of children) {
      if (template.centerId && template.centerId !== child.centerId) continue;
      if (type === "AGE_GROUP" && !childMatchesAgeGroup(template, child)) continue;
      // Family-wide forms are sent once per family, without a child.
      if (!["CHILD", "AGE_GROUP"].includes(type)) continue;
      const latest = submissions.find((s) => s.templateId === template.id && s.childId === child.id);
      const expiration = latest?.expiresAt || template.dueDate || null;
      const days = expiration ? Math.round((new Date(expiration).setHours(0, 0, 0, 0) - startOfToday.getTime()) / DAY) : null;
      const status = !latest && !expiration ? "OVERDUE" : days < 0 ? "OVERDUE" : days <= 30 ? "DUE_SOON" : "CURRENT";
      rows.push({
        key: `${template.id}|${child.id}`,
        templateId: template.id,
        formType: template.title,
        childId: child.id,
        child: [child.firstName, child.lastName].filter(Boolean).join(" "),
        parent: parentName(child),
        expiration,
        daysUntilDue: days,
        status,
        submitted: Boolean(latest),
        submissionId: latest?.id || null,
        signedBy: latest?.data?.certification?.signedName || null,
        signedAt: latest?.data?.certification?.signedAt || null,
        note: notes.find((n) => n.templateId === template.id && n.childId === child.id)?.note || "",
      });
    }
  }
  rows.sort((a, b) => (a.daysUntilDue ?? -99999) - (b.daysUntilDue ?? -99999));
  return res.status(200).json({
    rows,
    formTypes: templates.map((t) => ({ id: t.id, title: t.title })),
    tiles: {
      overdue: rows.filter((r) => r.status === "OVERDUE").length,
      dueSoon: rows.filter((r) => r.status === "DUE_SOON").length,
      current: rows.filter((r) => r.status === "CURRENT").length,
      total: rows.length,
    },
  });
}
