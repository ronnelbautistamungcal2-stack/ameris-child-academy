import { getSession } from "@/lib/auth";
import { budgetAccess } from "@/lib/classroomBudgets";
import prisma from "@/lib/prisma";

/** POST /api/v1/classroom-budgets/:id/expenses { description, amount, date, category, receipt?, receiptFileName? }  (admins and coaches) */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }
    const budget = await prisma.classroomBudget.findUnique({ where: { id: String(req.query.id) } });
    if (!budget) return res.status(404).json({ error: "Budget not found" });
    const access = await budgetAccess(session.user, budget.centerId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    if (!access.canSpend) return res.status(403).json({ error: "Forbidden" });

    const { description, amount, date, category, receipt, receiptFileName } = req.body || {};
    const value = Number(amount);
    if (!String(description || "").trim() || !Number.isFinite(value) || value <= 0 || !date) {
      return res.status(400).json({ error: "description, amount, and date are required" });
    }
    const expense = await prisma.budgetExpense.create({
      data: {
        budgetId: budget.id,
        description: String(description).trim().slice(0, 300),
        amount: value,
        date: new Date(date),
        category: category || "Other",
        receipt: receipt || null,
        receiptFileName: receiptFileName || null,
        recordedById: session.user.id,
      },
      include: { recordedBy: { select: { name: true } } },
    });
    return res.status(201).json(expense);
  } catch (e) {
    console.error("classroom-budgets/[id]/expenses error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
