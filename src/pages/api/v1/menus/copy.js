import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { dbDate } from "@/lib/menuAccess";
import { addDays, isDateKey, parseDateKey, sameDayPreviousMonth, toDateKey, weekDays } from "@/lib/menuPlan";

/**
 * POST /api/v1/menus/copy  { centerId, start: Monday "YYYY-MM-DD", from: "week" | "month" }
 * Admin only. Fills the planned menu for Monday–Friday of that week from the
 * previous week, or from the same weekdays of the previous month. Lines the
 * admin already filled in are kept, and every copied line stays editable.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }
    const user = session.user;
    if (!hasAnyRole(user, ["ADMIN"])) return res.status(403).json({ error: "Only admins can copy the menu" });

    const { centerId, start, from } = req.body || {};
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!isDateKey(start) || parseDateKey(start).getDay() !== 1) {
      return res.status(400).json({ error: "start must be a Monday (YYYY-MM-DD)" });
    }
    if (!["week", "month"].includes(from)) return res.status(400).json({ error: "from must be week or month" });
    const center = await prisma.center.findUnique({ where: { id: String(centerId) }, select: { id: true } });
    if (!center) return res.status(404).json({ error: "Center not found" });

    const targets = weekDays(parseDateKey(start));
    const sourceFor = new Map(
      targets.map((day) => [toDateKey(from === "week" ? addDays(day, -7) : sameDayPreviousMonth(day)), toDateKey(day)]),
    );

    const [sourceRows, targetRows] = await Promise.all([
      prisma.menuItem.findMany({
        where: { centerId: center.id, kind: "PLANNED", date: { in: [...sourceFor.keys()].map(dbDate) } },
      }),
      prisma.menuItem.findMany({
        where: { centerId: center.id, kind: "PLANNED", date: { in: targets.map((d) => dbDate(toDateKey(d))) } },
        select: { date: true, meal: true, ageGroup: true, component: true },
      }),
    ]);
    const filled = new Set(
      targetRows.map((r) => `${r.date.toISOString().slice(0, 10)}|${r.meal}|${r.ageGroup}|${r.component}`),
    );

    const data = [];
    for (const row of sourceRows) {
      const date = sourceFor.get(row.date.toISOString().slice(0, 10));
      if (filled.has(`${date}|${row.meal}|${row.ageGroup}|${row.component}`)) continue;
      data.push({
        centerId: center.id,
        date: dbDate(date),
        meal: row.meal,
        ageGroup: row.ageGroup,
        component: row.component,
        kind: "PLANNED",
        item: row.item,
        updatedById: user.id,
      });
    }
    if (data.length) await prisma.menuItem.createMany({ data, skipDuplicates: true });

    const sources = [...sourceFor.keys()];
    return res.status(200).json({
      copied: data.length,
      found: sourceRows.length,
      sourceStart: sources[0],
      sourceEnd: sources[sources.length - 1],
    });
  } catch (e) {
    console.error("menus copy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
