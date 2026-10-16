import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { MAX_ITEM_LENGTH, MENU_KINDS, ageGroupsFor, isDateKey, isValidLine, mealKeysFor } from "@/lib/menuPlan";
import { canEditMenuKind, dbDate, menuCenterIds } from "@/lib/menuAccess";

const MAX_DAYS = 31;
const MAX_LINES_PER_SAVE = 2000;

function serialize(row) {
  return {
    date: row.date.toISOString().slice(0, 10),
    meal: row.meal,
    ageGroup: row.ageGroup,
    component: row.component,
    kind: row.kind,
    item: row.item,
  };
}

const CENTER_SELECT = { id: true, name: true, meals: true, mealAgeGroups: true };

/**
 * GET  /api/v1/menus?centerId=&start=YYYY-MM-DD&days=5
 *      Menu lines for `days` days from `start` at one center (the first one
 *      the user can see when centerId is left out), with the center's meals
 *      and age group rows. Parents get the planned menu only.
 * PUT  /api/v1/menus  { centerId, kind, items: [{ date, meal, ageGroup, component, item }] }
 *      PLANNED: admins. SERVED: admins and the center's kitchen staff.
 *      A blank `item` clears that line.
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

      const scope = await menuCenterIds(user);
      const centers = await prisma.center.findMany({
        where: scope ? { id: { in: scope } } : {},
        select: CENTER_SELECT,
        orderBy: { name: "asc" },
      });
      const requested = req.query.centerId ? String(req.query.centerId) : "";
      const center = requested ? centers.find((c) => c.id === requested) : centers[0];
      if (requested && !center) return res.status(403).json({ error: "You do not have access to this center" });
      if (!center) return res.status(200).json({ center: null, centers: [], meals: [], ageGroups: [], items: [] });

      const parentOnly = hasAnyRole(user, ["PARENT"]) && !hasAnyRole(user, ["ADMIN", "KITCHEN_STAFF"]);
      const from = dbDate(start);
      const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
      const rows = await prisma.menuItem.findMany({
        where: {
          centerId: center.id,
          date: { gte: from, lt: to },
          ...(parentOnly ? { kind: "PLANNED" } : {}),
        },
        orderBy: [{ date: "asc" }],
      });
      return res.status(200).json({
        center: { id: center.id, name: center.name },
        centers: centers.map((c) => ({ id: c.id, name: c.name })),
        meals: mealKeysFor(center),
        ageGroups: ageGroupsFor(center),
        items: rows.map(serialize),
      });
    }

    if (req.method === "PUT") {
      const kind = req.body?.kind === undefined ? "PLANNED" : req.body.kind;
      if (!MENU_KINDS.includes(kind)) return res.status(400).json({ error: "kind must be PLANNED or SERVED" });
      const centerId = req.body?.centerId ? String(req.body.centerId) : "";
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (!(await canEditMenuKind(user, centerId, kind))) {
        return res.status(403).json({
          error: kind === "PLANNED" ? "Only admins can edit the menu" : "Only kitchen staff can record what was served",
        });
      }
      const center = await prisma.center.findUnique({ where: { id: centerId }, select: CENTER_SELECT });
      if (!center) return res.status(404).json({ error: "Center not found" });

      const lines = req.body?.items;
      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }
      if (lines.length > MAX_LINES_PER_SAVE) {
        return res.status(400).json({ error: "Too many lines in one save" });
      }

      const meals = new Set(mealKeysFor(center));
      const groups = new Set(ageGroupsFor(center).map((g) => g.key));
      for (const line of lines) {
        if (
          !isDateKey(line?.date) ||
          !meals.has(line.meal) ||
          !groups.has(line.ageGroup) ||
          !isValidLine(line.meal, line.ageGroup, line.component)
        ) {
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
          const key = {
            centerId,
            date: dbDate(line.date),
            meal: line.meal,
            ageGroup: line.ageGroup,
            component: line.component,
            kind,
          };
          const item = String(line.item ?? "").trim();
          if (!item) return prisma.menuItem.deleteMany({ where: key });
          return prisma.menuItem.upsert({
            where: { centerId_date_meal_ageGroup_component_kind: key },
            create: { ...key, item, updatedById: user.id },
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
