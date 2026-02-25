import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    const budget = await prisma.classroomBudget.findUnique({ where: { id } });
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const { description, amount, date, category, receipt, receiptFileName } = req.body || {};
    if (!description || amount === undefined || !date) {
      return res.status(400).json({ error: "description, amount, and date are required" });
    }

    const expense = await prisma.budgetExpense.create({
      data: {
        budgetId: id,
        description,
        amount: parseFloat(amount),
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
