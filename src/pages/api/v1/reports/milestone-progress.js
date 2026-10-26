import { getSession, hasAccessToCenter } from "@/lib/auth";
import { milestoneParams, milestoneProgressReport } from "@/lib/milestoneReports";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";

/**
 * GET /api/v1/reports/milestone-progress?centerId=&date=&minMonths=&maxMonths=&categoryId=&subCategory=
 * Milestone Progress Report (admins and Student Support at the center).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!hasAnyRole(session.user, ["ADMIN", "STUDENT_SUPPORT"])) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const center = centerId ? await prisma.center.findUnique({ where: { id: centerId }, select: { id: true, name: true } }) : null;
  if (!center) return res.status(400).json({ error: "centerId is required" });
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) return res.status(403).json({ error: "Forbidden" });
  const params = milestoneParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });
  return res.status(200).json({ center, ...params, ...(await milestoneProgressReport({ centerId, ...params })) });
}
