import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { dbDate } from "@/lib/menuAccess";
import { addDays, isDateKey, parseDateKey, previousMonthPairs, toDateKey, weekDays } from "@/lib/menuPlan";

/**
 * POST /api/v1/menus/copy
 *   { centerId, from: "week", start: Monday "YYYY-MM-DD" }
 *     Fills Monday–Friday of that week from the week before.
 *   { centerId, from: "month", month: "YYYY-MM" }
 *     Fills every weekday of that month from the previous month, matching
 *     each day to the same weekday in the same week (see previousMonthPairs).
 * Admin only. Lines the admin already filled in are kept, and every copied
 * line stays editable.
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

    const { centerId, start, from, month } = req.body || {};
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!["week", "month"].includes(from)) return res.status(400).json({ error: "from must be week or month" });
    if (from === "week" && (!isDateKey(start) || parseDateKey(start).getDay() !== 1)) {
      return res.status(400).json({ error: "start must be a Monday (YYYY-MM-DD)" });
    }
    if (from === "month" && !isDateKey(`${month}-01`)) {
      return res.status(400).json({ error: "month must be YYYY-MM" });
    }
    const center = await prisma.center.findUnique({ where: { id: String(centerId) }, select: { id: true } });
    if (!center) return res.status(404).json({ error: "Center not found" });

    const pairs =
      from === "week"
        ? weekDays(parseDateKey(start)).map((day) => [toDateKey(addDays(day, -7)), toDateKey(day)])
        : previousMonthPairs(month);
    // A source day can feed two target days (a 5th weekday reuses the last one).
    const targetsFor = new Map();
    for (const [source, target] of pairs) targetsFor.set(source, [...(targetsFor.get(source) || []), target]);
    const targets = pairs.map(([, target]) => target);

    const [sourceRows, targetRows] = await Promise.all([
      prisma.menuItem.findMany({
        where: { centerId: center.id, kind: "PLANNED", date: { in: [...targetsFor.keys()].map(dbDate) } },
      }),
      prisma.menuItem.findMany({
        where: { centerId: center.id, kind: "PLANNED", date: { in: targets.map(dbDate) } },
        select: { date: true, meal: true, ageGroup: true, component: true },
      }),
    ]);
    const filled = new Set(
      targetRows.map((r) => `${r.date.toISOString().slice(0, 10)}|${r.meal}|${r.ageGroup}|${r.component}`),
    );

    const data = [];
    for (const row of sourceRows) {
      for (const date of targetsFor.get(row.date.toISOString().slice(0, 10)) || []) {
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
    }
    if (data.length) await prisma.menuItem.createMany({ data, skipDuplicates: true });

    return res.status(200).json({
      copied: data.length,
      found: sourceRows.length,
      sourceStart: pairs[0][0],
      sourceEnd: pairs[pairs.length - 1][0],
      targetStart: targets[0],
      targetEnd: targets[targets.length - 1],
    });
  } catch (e) {
    console.error("menus copy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
