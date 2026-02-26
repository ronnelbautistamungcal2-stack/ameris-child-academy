import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;

  if (req.method === "GET") {
    // Admin sees all; parent sees their own; others see own.
    const where =
      user.role === "ADMIN" ? {} : { submittedById: user.id };

    const subs = await prisma.formSubmission.findMany({
      where,
      include: {
        template: true,
        child: true,
        submittedBy: { select: { id: true, email: true, role: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.status(200).json(subs);
  }

  if (req.method === "POST") {
    const { templateId, childId, data } = req.body || {};
    if (!templateId) {
      return res.status(400).json({ error: "templateId is required" });
    }

    const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.active) {
      return res.status(404).json({ error: "Form template not found" });
    }

    if (user.role !== template.targetRole && user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (template.centerId && user.role !== "ADMIN" && user.role !== "PARENT") {
      const ok = await hasAccessToCenter(user.id, template.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    if (childId) {
      const child = await prisma.child.findUnique({ where: { id: childId } });
      if (!child) return res.status(404).json({ error: "Child not found" });
      if (user.role === "PARENT" && child.parentId !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (user.role !== "ADMIN" && template.centerId && child.centerId !== template.centerId) {
        return res.status(400).json({ error: "Child is not in the template center" });
      }
    }

    let expiresAt = null;
    if (template.requiresRenewal && template.renewalPeriodDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + template.renewalPeriodDays);
    }

    const created = await prisma.formSubmission.create({
      data: {
        templateId,
        submittedById: user.id,
        childId: childId || null,
        data: data ?? null,
        expiresAt,
      },
      include: { template: true, child: true },
    });
    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

