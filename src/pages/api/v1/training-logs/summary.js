import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, userId, from, to } = req.query;
    const resolvedUserId = session.user.role === "TEACHER" ? session.user.id : userId;

    const where = {};
    if (centerId) where.centerId = centerId;
    if (resolvedUserId) where.userId = resolvedUserId;
    if (from || to) {
      const dateFilter = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    const logs = await prisma.trainingLog.findMany({
      where,
      select: { hours: true, category: true },
    });

    const summary = { totalHours: 0, byCategory: {}, totalEntries: logs.length };
    for (const l of logs) {
      summary.totalHours += l.hours;
      if (!summary.byCategory[l.category]) summary.byCategory[l.category] = 0;
      summary.byCategory[l.category] += l.hours;
    }
    summary.totalHours = Math.round(summary.totalHours * 100) / 100;
    for (const cat of Object.keys(summary.byCategory)) {
      summary.byCategory[cat] = Math.round(summary.byCategory[cat] * 100) / 100;
    }

    return res.status(200).json(summary);
  } catch (e) {
    console.error("training-logs/summary error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
