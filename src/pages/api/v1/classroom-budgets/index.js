import { getSession } from "@/lib/auth";
import { BUDGET_PERIODS, budgetAccess, dbDate, findOverlap, periodEnd, renewBudgets, serializeBudget, todayKey } from "@/lib/classroomBudgets";
import prisma from "@/lib/prisma";

const INCLUDE = {
  classRoom: { select: { id: true, name: true } },
  expenses: { include: { recordedBy: { select: { name: true } } }, orderBy: { date: "desc" } },
};
const isDateKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

/**
 * GET  /api/v1/classroom-budgets?centerId=&from=&to=[&classRoomId=]
 *      Budgets overlapping from..to (default: the period covering today).
 *      Admins and the center's coaches; auto-renewing budgets are renewed first.
 * POST /api/v1/classroom-budgets { centerId, classRoomId, period, startDate, allocatedAmount, autoRenew, notes }
 *      Admins only.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const centerId = String(req.query.centerId || req.body?.centerId || "");
    const access = await budgetAccess(session.user, centerId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    if (req.method === "GET") {
      await renewBudgets(centerId);
      const from = isDateKey(req.query.from) ? req.query.from : todayKey();
      const to = isDateKey(req.query.to) ? req.query.to : from;
      const budgets = await prisma.classroomBudget.findMany({
        where: {
          centerId,
          ...(req.query.classRoomId ? { classRoomId: String(req.query.classRoomId) } : {}),
          startDate: { lte: dbDate(to) },
          endDate: { gte: dbDate(from) },
        },
        include: INCLUDE,
        orderBy: [{ classRoom: { name: "asc" } }, { startDate: "desc" }],
      });
      return res.status(200).json({ budgets: budgets.map(serializeBudget), canManage: access.canManage, canSpend: access.canSpend });
    }

    if (req.method === "POST") {
      if (!access.canManage) return res.status(403).json({ error: "Only admins can add a budget" });
      const { classRoomId, period, startDate, allocatedAmount, autoRenew, notes } = req.body || {};
      if (!BUDGET_PERIODS.some((p) => p.value === period)) return res.status(400).json({ error: "Choose how often the budget runs" });
      if (!isDateKey(startDate)) return res.status(400).json({ error: "Choose a start date" });
      const amount = Number(allocatedAmount);
      if (allocatedAmount === "" || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Enter the budget amount" });
      const room = await prisma.classRoom.findFirst({ where: { id: String(classRoomId || ""), centerId }, select: { id: true } });
      if (!room) return res.status(400).json({ error: "Choose a classroom" });
      const endDate = periodEnd(period, startDate);
      if (await findOverlap(room.id, startDate, endDate)) {
        return res.status(409).json({ error: "This classroom already has a budget for part of that period" });
      }
      const created = await prisma.classroomBudget.create({
        data: {
          centerId,
          classRoomId: room.id,
          period,
          startDate: dbDate(startDate),
          endDate: dbDate(endDate),
          autoRenew: autoRenew === true,
          allocatedAmount: amount,
          notes: notes ? String(notes).slice(0, 500) : null,
        },
        include: INCLUDE,
      });
      return res.status(201).json(serializeBudget(created));
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("classroom-budgets error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
