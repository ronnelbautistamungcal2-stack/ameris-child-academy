import { getSession } from "@/lib/auth";
import { isDateKey } from "@/lib/foodReports";
import { mealClaimReport } from "@/lib/foodReportsServer";
import { reportCenter } from "@/lib/reportAccess";

/**
 * GET /api/v1/reports/meal-claim?centerId=&from=&to=[&enrolledOnly=1]
 * Meal Claim with its summary (admins, and coaches at their centers).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const access = await reportCenter(session.user, req.query.centerId, ["ADMIN", "COACH"]);
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { center } = access;
  const centerId = center.id;
  const { from, to } = req.query;
  if (!isDateKey(from) || !isDateKey(to) || from > to) return res.status(400).json({ error: "Choose a valid date range" });
  if ((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000 > 92) return res.status(400).json({ error: "Choose 3 months or less" });
  return res.status(200).json({ center, from, to, ...(await mealClaimReport({ centerId, from, to, enrolledOnly: req.query.enrolledOnly === "1" })) });
}
