import { getSession } from "@/lib/auth";
import { budgetAccess } from "@/lib/classroomBudgets";
import prisma from "@/lib/prisma";

/**
 * PUT    /api/v1/classroom-budgets/:id/expenses/:expenseId
 * DELETE /api/v1/classroom-budgets/:id/expenses/:expenseId
 * Admins and the center's coaches.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const expense = await prisma.budgetExpense.findFirst({
      where: { id: String(req.query.expenseId), budgetId: String(req.query.id) },
      include: { budget: { select: { centerId: true } } },
    });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    const access = await budgetAccess(session.user, expense.budget.centerId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    if (!access.canSpend) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "PUT") {
      const { description, amount, date, category, receipt, receiptFileName } = req.body || {};
      const data = {};
      if (description !== undefined) data.description = String(description).trim().slice(0, 300);
      if (amount !== undefined) {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "Enter the amount" });
        data.amount = value;
      }
      if (date !== undefined) data.date = new Date(date);
      if (category !== undefined) data.category = category;
      if (receipt !== undefined) data.receipt = receipt;
      if (receiptFileName !== undefined) data.receiptFileName = receiptFileName;
      const updated = await prisma.budgetExpense.update({ where: { id: expense.id }, data, include: { recordedBy: { select: { name: true } } } });
      return res.status(200).json(updated);
    }
    if (req.method === "DELETE") {
      await prisma.budgetExpense.delete({ where: { id: expense.id } });
      return res.status(204).end();
    }
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets expenses/[expenseId] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
