import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") return handleGet(req, res);
    if (req.method === "PUT") return handlePut(req, res);
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const { id } = req.query;
  const budget = await prisma.classroomBudget.findUnique({
    where: { id },
    include: {
      classRoom: { select: { id: true, name: true } },
      expenses: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!budget) return res.status(404).json({ error: "Budget not found" });

  const spent = budget.expenses.reduce((sum, e) => sum + e.amount, 0);
  return res.status(200).json({ ...budget, spent, remaining: budget.allocatedAmount - spent });
}

async function handlePut(req, res) {
  const { id } = req.query;
  const budget = await prisma.classroomBudget.findUnique({ where: { id } });
  if (!budget) return res.status(404).json({ error: "Budget not found" });

  const { allocatedAmount, notes } = req.body || {};
  const data = {};
  if (allocatedAmount !== undefined) data.allocatedAmount = parseFloat(allocatedAmount);
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.classroomBudget.update({
    where: { id },
    data,
    include: {
      classRoom: { select: { id: true, name: true } },
    },
  });

  return res.status(200).json(updated);
}
