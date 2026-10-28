import { getSession } from "@/lib/auth";
import { keyOf, nextDueAfter, parseRequirement } from "@/lib/complianceRequirements";
import prisma from "@/lib/prisma";
import { serializeRequirement } from "./index";

/**
 * PUT    /api/v1/compliance/requirements/:id { ...requirement }        edit
 * PUT    /api/v1/compliance/requirements/:id { action: "complete" }    mark it done:
 *        logs the completion and moves nextDue to the next repeat
 * PUT    /api/v1/compliance/requirements/:id { action: "undo" }        clear this cycle's completion
 * DELETE /api/v1/compliance/requirements/:id
 * Admins only.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: String(req.query.id) } });
  if (!requirement) return res.status(404).json({ error: "Requirement not found" });

  if (req.method === "PUT") {
    const action = req.body?.action;
    if (action === "complete") {
      const next = nextDueAfter(requirement.frequency, requirement.nextDue, requirement.repeatOn);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.complianceCompletion.create({ data: { requirementId: requirement.id, dueDate: requirement.nextDue, completedById: session.user.id } });
        return tx.complianceRequirement.update({
          where: { id: requirement.id },
          data: { lastCompletedAt: new Date(), ...(next ? { nextDue: next } : {}) },
        });
      });
      return res.status(200).json(serializeRequirement(updated));
    }
    if (action === "undo") {
      const last = await prisma.complianceCompletion.findFirst({ where: { requirementId: requirement.id }, orderBy: { completedAt: "desc" } });
      const updated = await prisma.$transaction(async (tx) => {
        if (last) await tx.complianceCompletion.delete({ where: { id: last.id } });
        const previous = await tx.complianceCompletion.findFirst({ where: { requirementId: requirement.id }, orderBy: { completedAt: "desc" } });
        return tx.complianceRequirement.update({
          where: { id: requirement.id },
          data: { lastCompletedAt: previous?.completedAt || null, ...(last ? { nextDue: last.dueDate } : {}) },
        });
      });
      return res.status(200).json(serializeRequirement(updated));
    }
    const parsed = parseRequirement({ ...requirement, nextDue: keyOf(new Date(requirement.nextDue)), ...(req.body || {}) });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const updated = await prisma.complianceRequirement.update({ where: { id: requirement.id }, data: parsed.data });
    return res.status(200).json(serializeRequirement(updated));
  }

  if (req.method === "DELETE") {
    await prisma.complianceRequirement.delete({ where: { id: requirement.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
