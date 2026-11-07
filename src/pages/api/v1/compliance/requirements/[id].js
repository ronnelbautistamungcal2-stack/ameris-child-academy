import { getSession } from "@/lib/auth";
import { keyOf, nextDueAfter, parseRequirement } from "@/lib/complianceRequirements";
import prisma from "@/lib/prisma";
import { serializeRequirement } from "./index";

/**
 * PUT    /api/v1/compliance/requirements/:id { ...requirement }        edit
 * PUT    /api/v1/compliance/requirements/:id { action: "complete" }    mark it done:
 *        logs the completion, keeps this row as completed and, when it
 *        repeats, adds a new row due on the next repeat -> { requirement, next }
 * PUT    /api/v1/compliance/requirements/:id { action: "undo" }        reopen it and drop
 *        the untouched next row it created -> { requirement, removedId }
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
      if (requirement.done) return res.status(200).json({ requirement: serializeRequirement(requirement), next: null });
      // With no due date set, the cycle runs from the day it's checked off.
      const now = new Date();
      const dueDate = requirement.nextDue || new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const nextDue = nextDueAfter(requirement.frequency, dueDate, requirement.repeatOn);
      const result = await prisma.$transaction(async (tx) => {
        await tx.complianceCompletion.create({ data: { requirementId: requirement.id, dueDate, completedById: session.user.id } });
        const done = await tx.complianceRequirement.update({
          where: { id: requirement.id },
          data: { done: true, lastCompletedAt: new Date() },
        });
        const next = nextDue
          ? await tx.complianceRequirement.create({
              data: {
                centerId: requirement.centerId,
                name: requirement.name,
                description: requirement.description,
                category: requirement.category,
                frequency: requirement.frequency,
                repeatOn: requirement.repeatOn,
                appliesToRoles: requirement.appliesToRoles,
                ageGroups: requirement.ageGroups,
                notes: requirement.notes,
                nextDue,
                previousId: requirement.id,
                createdById: session.user.id,
              },
            })
          : null;
        return { done, next };
      });
      return res.status(200).json({ requirement: serializeRequirement(result.done), next: result.next ? serializeRequirement(result.next) : null });
    }
    if (action === "undo") {
      const last = await prisma.complianceCompletion.findFirst({ where: { requirementId: requirement.id }, orderBy: { completedAt: "desc" } });
      // The row this check-off created goes too, unless it was checked off itself.
      const followUp = await prisma.complianceRequirement.findFirst({ where: { previousId: requirement.id, done: false } });
      const updated = await prisma.$transaction(async (tx) => {
        if (last) await tx.complianceCompletion.delete({ where: { id: last.id } });
        if (followUp) await tx.complianceRequirement.delete({ where: { id: followUp.id } });
        const previous = await tx.complianceCompletion.findFirst({ where: { requirementId: requirement.id }, orderBy: { completedAt: "desc" } });
        return tx.complianceRequirement.update({
          where: { id: requirement.id },
          // Rows from before the split moved nextDue forward; put it back.
          data: { done: false, lastCompletedAt: previous?.completedAt || null, ...(last && !requirement.done ? { nextDue: last.dueDate } : {}) },
        });
      });
      return res.status(200).json({ requirement: serializeRequirement(updated), removedId: followUp?.id || null });
    }
    const parsed = parseRequirement({ ...requirement, nextDue: requirement.nextDue ? keyOf(new Date(requirement.nextDue)) : "", ...(req.body || {}) });
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
