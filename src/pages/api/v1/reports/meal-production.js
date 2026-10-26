import { getSession } from "@/lib/auth";
import { isDateKey } from "@/lib/foodReports";
import { mealProductionReport } from "@/lib/foodReportsServer";
import { dbDate } from "@/lib/menuAccess";
import { getMeal } from "@/lib/menuPlan";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/reports/meal-production?centerId=&meal=&from=&to=
 *     Meal Production Record for one meal (admins).
 * PUT /api/v1/reports/meal-production { centerId, meal, date, ageGroup, planned }
 *     The planned number served, typed in on the report (blank clears it).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  const centerId = String(req.query.centerId || req.body?.centerId || "");
  const meal = String(req.query.meal || req.body?.meal || "");
  if (!centerId || !(await prisma.center.findUnique({ where: { id: centerId }, select: { id: true } }))) {
    return res.status(400).json({ error: "centerId is required" });
  }
  if (!getMeal(meal)) return res.status(400).json({ error: "Unknown meal" });

  if (req.method === "GET") {
    const { from, to } = req.query;
    if (!isDateKey(from) || !isDateKey(to) || from > to) return res.status(400).json({ error: "Choose a valid date range" });
    return res.status(200).json({ from, to, ...(await mealProductionReport({ centerId, meal, from, to })) });
  }

  if (req.method === "PUT") {
    const { date, ageGroup } = req.body || {};
    if (!isDateKey(date) || !ageGroup) return res.status(400).json({ error: "date and ageGroup are required" });
    const raw = req.body.planned;
    const key = { centerId_date_meal_ageGroup: { centerId, date: dbDate(date), meal, ageGroup: String(ageGroup) } };
    if (raw === null || raw === undefined || raw === "") {
      await prisma.mealProductionCount.deleteMany({ where: { centerId, date: dbDate(date), meal, ageGroup: String(ageGroup) } });
      return res.status(200).json({ planned: null });
    }
    const planned = Number(raw);
    if (!Number.isInteger(planned) || planned < 0 || planned > 9999) return res.status(400).json({ error: "Planned must be a whole number" });
    await prisma.mealProductionCount.upsert({
      where: key,
      update: { planned, updatedById: session.user.id },
      create: { centerId, date: dbDate(date), meal, ageGroup: String(ageGroup), planned, updatedById: session.user.id },
    });
    return res.status(200).json({ planned });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
