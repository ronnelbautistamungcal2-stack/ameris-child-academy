import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isNonAdminEmployeeRole } from "@/lib/roles";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!["ADMIN", "TEACHER", "OTHER_STAFF", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId, userId, from, to } = req.query;
    if (centerId && session.user.role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
    }
    const resolvedUserId = isNonAdminEmployeeRole(session.user.role)
      ? session.user.id
      : userId;

    const where = {};
    if (centerId) where.centerId = centerId;
    if (resolvedUserId) where.userId = resolvedUserId;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    if (from || to) where.date = dateFilter;

    const records = await prisma.staffAttendance.findMany({
      where,
      select: { status: true, lateMinutes: true },
    });

    const summary = { present: 0, late: 0, absent: 0, halfDay: 0, totalDays: records.length, totalLateMinutes: 0 };
    for (const r of records) {
      if (r.status === "PRESENT") summary.present++;
      else if (r.status === "LATE") { summary.late++; summary.totalLateMinutes += r.lateMinutes || 0; }
      else if (r.status === "ABSENT") summary.absent++;
      else if (r.status === "HALF_DAY") summary.halfDay++;
    }

    return res.status(200).json(summary);
  } catch (e) {
    console.error("staff-attendance/summary error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
