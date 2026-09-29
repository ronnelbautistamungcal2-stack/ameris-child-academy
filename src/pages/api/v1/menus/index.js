import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { MAX_ITEM_LENGTH, isDateKey, isValidLine } from "@/lib/menuPlan";

const MAX_DAYS = 31;
const MAX_LINES_PER_SAVE = 2000;

function dbDate(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function serialize(row) {
  return {
    date: row.date.toISOString().slice(0, 10),
    meal: row.meal,
    ageGroup: row.ageGroup,
    component: row.component,
    item: row.item,
  };
}

/**
 * GET  /api/v1/menus?start=YYYY-MM-DD&days=5
 *      Planned menu lines for `days` days from `start`. Any signed-in user.
 * PUT  /api/v1/menus  { items: [{ date, meal, ageGroup, component, item }] }
 *      Admin only. Saves the given lines; a blank `item` clears that line.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const { start } = req.query;
      const days = req.query.days === undefined ? 5 : Number(req.query.days);
      if (!isDateKey(start)) {
        return res.status(400).json({ error: "start must be a YYYY-MM-DD date" });
      }
      if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        return res.status(400).json({ error: `days must be between 1 and ${MAX_DAYS}` });
      }

      const from = dbDate(start);
      const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
      const rows = await prisma.menuItem.findMany({
        where: { date: { gte: from, lt: to } },
        orderBy: [{ date: "asc" }],
      });
      return res.status(200).json({ items: rows.map(serialize) });
    }

    if (req.method === "PUT") {
      if (!hasAnyRole(user, ["ADMIN"])) {
        return res.status(403).json({ error: "Only admins can edit the menu" });
      }
      const lines = req.body?.items;
      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }
      if (lines.length > MAX_LINES_PER_SAVE) {
        return res.status(400).json({ error: "Too many lines in one save" });
      }

      for (const line of lines) {
        if (!isDateKey(line?.date) || !isValidLine(line.meal, line.ageGroup, line.component)) {
          return res.status(400).json({ error: "Invalid menu line", line });
        }
        if (String(line.item ?? "").trim().length > MAX_ITEM_LENGTH) {
          return res
            .status(400)
            .json({ error: `Menu items must be ${MAX_ITEM_LENGTH} characters or fewer`, line });
        }
      }

      await prisma.$transaction(
        lines.map((line) => {
          const where = {
            date_meal_ageGroup_component: {
              date: dbDate(line.date),
              meal: line.meal,
              ageGroup: line.ageGroup,
              component: line.component,
            },
          };
          const item = String(line.item ?? "").trim();
          if (!item) {
            return prisma.menuItem.deleteMany({ where: where.date_meal_ageGroup_component });
          }
          return prisma.menuItem.upsert({
            where,
            create: { ...where.date_meal_ageGroup_component, item, updatedById: user.id },
            update: { item, updatedById: user.id },
          });
        }),
      );

      return res.status(200).json({ saved: lines.length });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("menus error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
