import { getSession, hasAccessToCenter } from "@/lib/auth";
import { isEmployeeRole } from "@/lib/roles";
import prisma from "@/lib/prisma";
import { teacherPerformance } from "@/lib/teacherPerformance";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    // Every employee sees their own report (My Performance); admins, coaches
    // and HR also see their staff's (Staff Performance).
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const { centerId, teacherId, from, to } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    const canViewOthers = ["ADMIN", "COACH", "HR_STAFF"].includes(session.user.role);
    const resolvedTeacherId = !teacherId || teacherId === "me" || !canViewOthers ? session.user.id : teacherId;
    if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const dateFrom = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const report = await teacherPerformance(prisma, { teacherId: resolvedTeacherId, centerId, dateFrom, dateTo });
    if (!report) return res.status(404).json({ error: "Teacher not found" });
    return res.status(200).json(report);
  } catch (e) {
    console.error("analytics/teacher-perf-report error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
