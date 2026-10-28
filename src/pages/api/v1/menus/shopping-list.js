import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addDays, getMeal, isDateKey, mealKeysFor, parseDateKey, toDateKey, weekStartOf } from "@/lib/menuPlan";
import { dbDate, menuCenterIds } from "@/lib/menuAccess";

/**
 * GET /api/v1/menus/shopping-list?centerId=&start=YYYY-MM-DD
 * The kitchen's "Supplies Needed" list for the week from `start` (default:
 * next Monday): each planned menu item with the meals it is served for and how
 * many times it is served that week. Catered meals are left off (client
 * request 2026-10-02).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const centerId = String(req.query.centerId || "");
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  const scope = await menuCenterIds(session.user);
  if (scope && !scope.includes(centerId)) return res.status(403).json({ error: "Forbidden" });
  const center = await prisma.center.findUnique({ where: { id: centerId }, select: { id: true, meals: true } });
  if (!center) return res.status(404).json({ error: "Center not found" });

  const start = isDateKey(req.query.start) ? parseDateKey(req.query.start) : addDays(weekStartOf(new Date()), 7);
  const end = addDays(start, 6);
  const meals = mealKeysFor(center).filter((key) => !center.meals?.[key]?.catered);

  const rows = await prisma.menuItem.findMany({
    where: {
      centerId,
      kind: "PLANNED",
      meal: { in: meals },
      date: { gte: dbDate(toDateKey(start)), lte: dbDate(toDateKey(end)) },
    },
    select: { date: true, meal: true, item: true },
  });

  const byItem = new Map();
  for (const row of rows) {
    const name = String(row.item || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byItem.has(key)) byItem.set(key, { item: name, meals: new Set(), servings: new Set() });
    const entry = byItem.get(key);
    entry.meals.add(row.meal);
    // Served once per meal per day, however many age groups get it.
    entry.servings.add(`${row.date.toISOString().slice(0, 10)}|${row.meal}`);
  }

  const items = [...byItem.values()]
    .map((entry) => ({
      item: entry.item,
      meals: meals.filter((key) => entry.meals.has(key)).map((key) => getMeal(key)?.label || key),
      timesServed: entry.servings.size,
    }))
    .sort((a, b) => a.item.localeCompare(b.item));

  return res.status(200).json({ start: toDateKey(start), end: toDateKey(end), items });
}
