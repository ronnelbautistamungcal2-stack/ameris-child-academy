import { getSession } from "@/lib/auth";
import { INFANT_GROUPS, ageInMonths, dateKeysBetween, infantGroupFor, isDateKey, localDateKey } from "@/lib/foodReports";
import { canEditMenuKind, dbDate } from "@/lib/menuAccess";
import { componentsFor, getMeal } from "@/lib/menuPlan";
import prisma from "@/lib/prisma";

const MAX_AMOUNT = 40;
const CHILD_SELECT = { id: true, firstName: true, lastName: true, birthDate: true };

const childName = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim();

/** Children enrolled at the center on a day (no end date, or ending on/after it). */
function enrolledOn(centerId, dateKey) {
  const day = dbDate(dateKey);
  return prisma.child.findMany({
    where: {
      centerId,
      AND: [
        { OR: [{ enrollmentStartDate: null }, { enrollmentStartDate: { lte: new Date(day.getTime() + 86399999) } }] },
        { OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: day } }] },
      ],
    },
    select: CHILD_SELECT,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

/**
 * Kitchen Menu Planner - Infant Portions (client 2026-10-23). Admins and the
 * center's kitchen staff.
 * GET ?centerId=&start=YYYY-MM-DD&days=5&meal=
 *     How many infants in each infant row have portions recorded, per day.
 * GET ?centerId=&date=&meal=&ageGroup=
 *     The infants in that row that day (by age, plus anyone added), the
 *     served menu and each infant's portions.
 * PUT { centerId, date, meal, ageGroup, portions: [{ childId, component, amount }] }
 *     A blank amount clears that portion.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const centerId = String(req.query.centerId || req.body?.centerId || "");
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  if (!(await canEditMenuKind(session.user, centerId, "SERVED"))) return res.status(403).json({ error: "Forbidden" });
  const meal = String(req.query.meal || req.body?.meal || "");
  if (!getMeal(meal)) return res.status(400).json({ error: "Unknown meal" });

  if (req.method === "GET" && req.query.start) {
    const start = String(req.query.start);
    const days = Math.min(Math.max(Number(req.query.days) || 5, 1), 31);
    if (!isDateKey(start)) return res.status(400).json({ error: "start must be a YYYY-MM-DD date" });
    const end = new Date(`${start}T00:00:00`);
    end.setDate(end.getDate() + days - 1);
    const keys = dateKeysBetween(start, localDateKey(end));
    const rows = await prisma.infantPortion.findMany({
      where: { centerId, meal, date: { gte: dbDate(keys[0]), lte: dbDate(keys[keys.length - 1]) } },
      select: { date: true, ageGroup: true, childId: true },
    });
    const summary = {};
    for (const key of keys) {
      const children = await enrolledOn(centerId, key);
      for (const group of INFANT_GROUPS) {
        const expected = new Set(children.filter((c) => infantGroupFor(ageInMonths(c.birthDate, key)) === group).map((c) => c.id));
        const recorded = new Set(rows.filter((r) => r.date.toISOString().slice(0, 10) === key && r.ageGroup === group).map((r) => r.childId));
        for (const id of recorded) expected.add(id);
        summary[`${key}|${group}`] = { recorded: recorded.size, total: expected.size };
      }
    }
    return res.status(200).json({ summary });
  }

  const date = String(req.query.date || req.body?.date || "");
  const ageGroup = String(req.query.ageGroup || req.body?.ageGroup || "");
  if (!isDateKey(date)) return res.status(400).json({ error: "date must be a YYYY-MM-DD date" });
  if (!INFANT_GROUPS.includes(ageGroup)) return res.status(400).json({ error: "ageGroup must be an infant row" });
  const components = componentsFor(meal, ageGroup);

  if (req.method === "GET") {
    const [children, saved, menu] = await Promise.all([
      enrolledOn(centerId, date),
      prisma.infantPortion.findMany({ where: { centerId, date: dbDate(date), meal, ageGroup } }),
      prisma.menuItem.findMany({ where: { centerId, date: dbDate(date), meal, ageGroup } }),
    ]);
    const savedIds = new Set(saved.map((p) => p.childId));
    const extraIds = [...savedIds].filter((id) => !children.some((c) => c.id === id));
    const extras = extraIds.length ? await prisma.child.findMany({ where: { id: { in: extraIds } }, select: CHILD_SELECT }) : [];
    const pool = [...children, ...extras];
    const inRow = pool.filter((c) => savedIds.has(c.id) || infantGroupFor(ageInMonths(c.birthDate, date)) === ageGroup);
    const served = Object.fromEntries(menu.filter((m) => m.kind === "SERVED").map((m) => [m.component, m.item]));
    const planned = Object.fromEntries(menu.filter((m) => m.kind === "PLANNED").map((m) => [m.component, m.item]));
    return res.status(200).json({
      components: components.map((key) => ({ key, item: served[key] || planned[key] || "", servedRecorded: Boolean(served[key]) })),
      infants: inRow.map((c) => ({
        id: c.id,
        name: childName(c),
        months: ageInMonths(c.birthDate, date),
        portions: Object.fromEntries(saved.filter((p) => p.childId === c.id).map((p) => [p.component, p.amount])),
      })),
      others: children.filter((c) => !inRow.includes(c)).map((c) => ({ id: c.id, name: childName(c), months: ageInMonths(c.birthDate, date) })),
    });
  }

  if (req.method === "PUT") {
    const portions = Array.isArray(req.body?.portions) ? req.body.portions : null;
    if (!portions) return res.status(400).json({ error: "portions are required" });
    const childIds = [...new Set(portions.map((p) => String(p?.childId || "")))].filter(Boolean);
    const valid = new Set((await prisma.child.findMany({ where: { id: { in: childIds }, centerId }, select: { id: true } })).map((c) => c.id));
    for (const p of portions) {
      if (!valid.has(String(p?.childId))) return res.status(400).json({ error: "Unknown child" });
      if (!components.includes(p?.component)) return res.status(400).json({ error: "Unknown component" });
    }
    await prisma.$transaction(
      portions.map((p) => {
        const amount = String(p.amount ?? "").trim().slice(0, MAX_AMOUNT);
        const where = { centerId_date_meal_childId_component: { centerId, date: dbDate(date), meal, childId: p.childId, component: p.component } };
        return amount
          ? prisma.infantPortion.upsert({
              where,
              update: { amount, ageGroup, updatedById: session.user.id },
              create: { centerId, date: dbDate(date), meal, ageGroup, childId: p.childId, component: p.component, amount, updatedById: session.user.id },
            })
          : prisma.infantPortion.deleteMany({ where: { centerId, date: dbDate(date), meal, childId: p.childId, component: p.component } });
      }),
    );
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
