import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") return handleGet(req, res);
    if (req.method === "POST") return handlePost(req, res);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const { centerId, classRoomId, month } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (classRoomId) where.classRoomId = classRoomId;
  if (month) where.month = month;

  const budgets = await prisma.classroomBudget.findMany({
    where,
    include: {
      classRoom: { select: { id: true, name: true } },
      expenses: { orderBy: { date: "desc" } },
    },
    orderBy: { month: "desc" },
  });

  const result = budgets.map((b) => {
    const spent = b.expenses.reduce((sum, e) => sum + e.amount, 0);
    return { ...b, spent, remaining: b.allocatedAmount - spent };
  });

  return res.status(200).json(result);
}

async function handlePost(req, res) {
  const { centerId, classRoomId, month, allocatedAmount, notes } = req.body || {};
  if (!centerId || !classRoomId || !month || allocatedAmount === undefined) {
    return res.status(400).json({ error: "centerId, classRoomId, month, and allocatedAmount are required" });
  }

  const budget = await prisma.classroomBudget.upsert({
    where: { classRoomId_month: { classRoomId, month } },
    update: { allocatedAmount: parseFloat(allocatedAmount), notes: notes || null },
    create: {
      centerId,
      classRoomId,
      month,
      allocatedAmount: parseFloat(allocatedAmount),
      notes: notes || null,
    },
    include: {
      classRoom: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json(budget);
}
