import { getSession } from "@/lib/auth";
import { budgetAccess, serializeBudget } from "@/lib/classroomBudgets";
import prisma from "@/lib/prisma";

const INCLUDE = {
  classRoom: { select: { id: true, name: true } },
  expenses: { include: { recordedBy: { select: { name: true } } }, orderBy: { date: "desc" } },
};

/**
 * GET    /api/v1/classroom-budgets/:id
 * PUT    /api/v1/classroom-budgets/:id { allocatedAmount?, autoRenew?, notes? }  (admins)
 * DELETE /api/v1/classroom-budgets/:id                                         (admins)
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const budget = await prisma.classroomBudget.findUnique({ where: { id: String(req.query.id) }, include: INCLUDE });
    if (!budget) return res.status(404).json({ error: "Budget not found" });
    const access = await budgetAccess(session.user, budget.centerId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    if (req.method === "GET") return res.status(200).json(serializeBudget(budget));
    if (!access.canManage) return res.status(403).json({ error: "Only admins can change a budget" });

    if (req.method === "PUT") {
      const { allocatedAmount, autoRenew, notes } = req.body || {};
      const data = {};
      if (allocatedAmount !== undefined) {
        const amount = Number(allocatedAmount);
        if (allocatedAmount === "" || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Enter the budget amount" });
        data.allocatedAmount = amount;
      }
      if (autoRenew !== undefined) data.autoRenew = autoRenew === true;
      if (notes !== undefined) data.notes = notes ? String(notes).slice(0, 500) : null;
      const updated = await prisma.classroomBudget.update({ where: { id: budget.id }, data, include: INCLUDE });
      return res.status(200).json(serializeBudget(updated));
    }

    if (req.method === "DELETE") {
      await prisma.classroomBudget.delete({ where: { id: budget.id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
