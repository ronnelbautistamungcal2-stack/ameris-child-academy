import { getSession } from "@/lib/auth";
import { isDateKey } from "@/lib/foodReports";
import { mealClaimReport } from "@/lib/foodReportsServer";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/reports/meal-claim?centerId=&from=&to=
 * Meal Claim with its summary (admins).
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
  const { from, to } = req.query;
  if (!isDateKey(from) || !isDateKey(to) || from > to) return res.status(400).json({ error: "Choose a valid date range" });
  if ((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000 > 92) return res.status(400).json({ error: "Choose 3 months or less" });
  return res.status(200).json({ center, from, to, ...(await mealClaimReport({ centerId, from, to })) });
}
