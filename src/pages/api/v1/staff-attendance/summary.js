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
      select: {
        status: true,
        lateMinutes: true,
        userId: true,
        clockIn: true,
        clockOut: true,
        user: { select: { id: true, name: true } },
      },
    });

    const summary = { present: 0, late: 0, absent: 0, halfDay: 0, totalDays: records.length, totalLateMinutes: 0 };
    const byUser = new Map();
    for (const r of records) {
      if (r.status === "PRESENT") summary.present++;
      else if (r.status === "LATE") { summary.late++; summary.totalLateMinutes += r.lateMinutes || 0; }
      else if (r.status === "ABSENT") summary.absent++;
      else if (r.status === "HALF_DAY") summary.halfDay++;

      if (!byUser.has(r.userId)) {
        byUser.set(r.userId, {
          userId: r.userId,
          name: r.user?.name || "—",
          totalHours: 0,
          present: 0,
          late: 0,
          absent: 0,
          halfDay: 0,
          totalLateMinutes: 0,
        });
      }
      const row = byUser.get(r.userId);
      if (r.status === "PRESENT") row.present++;
      else if (r.status === "LATE") { row.late++; row.totalLateMinutes += r.lateMinutes || 0; }
      else if (r.status === "ABSENT") row.absent++;
      else if (r.status === "HALF_DAY") row.halfDay++;
      if (r.clockIn && r.clockOut) {
        row.totalHours += (new Date(r.clockOut) - new Date(r.clockIn)) / (1000 * 60 * 60);
      }
    }

    summary.reportByUser = [...byUser.values()]
      .map((row) => ({ ...row, totalHours: Math.round(row.totalHours * 100) / 100 }))
      .sort((a, b) => b.totalHours - a.totalHours);

    return res.status(200).json(summary);
  } catch (e) {
    console.error("staff-attendance/summary error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
