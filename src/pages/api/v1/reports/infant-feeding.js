import { getSession } from "@/lib/auth";
import { isDateKey } from "@/lib/foodReports";
import { feedingReportChildren, infantFeedingReport } from "@/lib/foodReportsServer";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/reports/infant-feeding?centerId=            the children to pick from
 * GET /api/v1/reports/infant-feeding?centerId=&childId=&from=&to=
 * Individual Infant Feeding Report (admins). Works for any child the center
 * has had, even once they are older or no longer enrolled.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const center = centerId ? await prisma.center.findUnique({ where: { id: centerId }, select: { id: true, name: true } }) : null;
  if (!center) return res.status(400).json({ error: "centerId is required" });
  if (!req.query.childId) return res.status(200).json({ center, children: await feedingReportChildren(centerId) });

  const { from, to } = req.query;
  if (!isDateKey(from) || !isDateKey(to) || from > to) return res.status(400).json({ error: "Choose a valid date range" });
  const report = await infantFeedingReport({ centerId, childId: String(req.query.childId), from, to });
  if (!report) return res.status(404).json({ error: "Child not found" });
  return res.status(200).json({ center, from, to, ...report });
}
