import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const CHECKLIST_STAFF_ROLES = ["TEACHER", "OTHER_STAFF", "COACH"];

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const dateFrom = from
      ? new Date(from)
      : (() => {
          const d = new Date();
          return new Date(d.getFullYear(), d.getMonth(), 1);
        })();
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);
    const dayRange = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)));

    const staff = await prisma.user.findMany({
      where: {
        centers: { some: { centerId: String(centerId) } },
        OR: [
          { role: { in: CHECKLIST_STAFF_ROLES } },
          { roles: { hasSome: CHECKLIST_STAFF_ROLES } },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    const checklists = await prisma.dailyChecklist.findMany({
      where: { centerId: String(centerId), active: true },
      select: {
        assignedUserId: true,
        assignees: { select: { userId: true } },
        _count: { select: { items: true } },
      },
    });

    const assignedCountByUser = new Map();
    for (const checklist of checklists) {
      const itemCount = checklist._count.items;
      if (!itemCount) continue;
      const userIds = new Set();
      if (checklist.assignedUserId) userIds.add(checklist.assignedUserId);
      for (const assignee of checklist.assignees) userIds.add(assignee.userId);
      for (const userId of userIds) {
        assignedCountByUser.set(userId, (assignedCountByUser.get(userId) || 0) + itemCount);
      }
    }

    const completions = await prisma.dailyChecklistCompletion.findMany({
      where: {
        date: { gte: dateFrom, lte: dateTo },
        item: { checklist: { centerId: String(centerId) } },
      },
      select: { completedById: true },
    });
    const completedCountByUser = new Map();
    for (const completion of completions) {
      completedCountByUser.set(
        completion.completedById,
        (completedCountByUser.get(completion.completedById) || 0) + 1,
      );
    }

    const results = staff.map((user) => {
      const assignedCount = assignedCountByUser.get(user.id) || 0;
      const completedCount = completedCountByUser.get(user.id) || 0;
      const expectedItems = assignedCount * dayRange;
      const pct =
        expectedItems > 0
          ? Math.min(100, Math.round((completedCount / expectedItems) * 100))
          : null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedCount,
        completedCount,
        pct,
      };
    });

    return res.status(200).json({
      dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      staff: results,
    });
  } catch (e) {
    console.error("analytics/staff-checklist-overview error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
