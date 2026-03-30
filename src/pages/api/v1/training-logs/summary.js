import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, unauthorized } from "@/lib/api-error";
import { optionalDate, optionalString } from "@/lib/validation";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const centerId = optionalString(req.query, "centerId");
  const userId = optionalString(req.query, "userId");
  const from = optionalDate(req.query, "from");
  const to = optionalDate(req.query, "to");
  const resolvedUserId = session.user.role === "TEACHER" ? session.user.id : userId;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (resolvedUserId) where.userId = resolvedUserId;
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const logs = await prisma.trainingLog.findMany({
    where,
    select: { hours: true, category: true },
  });

  const summary = { totalHours: 0, byCategory: {}, totalEntries: logs.length };
  for (const row of logs) {
    summary.totalHours += row.hours;
    summary.byCategory[row.category] = (summary.byCategory[row.category] || 0) + row.hours;
  }

  summary.totalHours = Math.round(summary.totalHours * 100) / 100;
  for (const key of Object.keys(summary.byCategory)) {
    summary.byCategory[key] = Math.round(summary.byCategory[key] * 100) / 100;
  }

  return res.status(200).json(summary);
}, { methods: ["GET"], logLabel: "training-logs/summary error:" });
