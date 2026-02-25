import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res);
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets expenses/[expenseId] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(req, res, session) {
  const { expenseId } = req.query;
  const expense = await prisma.budgetExpense.findUnique({ where: { id: expenseId } });
  if (!expense) return res.status(404).json({ error: "Expense not found" });

  const { description, amount, date, category, receipt, receiptFileName } = req.body || {};
  const data = {};
  if (description !== undefined) data.description = description;
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (date !== undefined) data.date = new Date(date);
  if (category !== undefined) data.category = category;
  if (receipt !== undefined) data.receipt = receipt;
  if (receiptFileName !== undefined) data.receiptFileName = receiptFileName;

  const updated = await prisma.budgetExpense.update({
    where: { id: expenseId },
    data,
    include: { recordedBy: { select: { name: true } } },
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res) {
  const { expenseId } = req.query;
  const expense = await prisma.budgetExpense.findUnique({ where: { id: expenseId } });
  if (!expense) return res.status(404).json({ error: "Expense not found" });

  await prisma.budgetExpense.delete({ where: { id: expenseId } });
  return res.status(200).json({ success: true });
}
