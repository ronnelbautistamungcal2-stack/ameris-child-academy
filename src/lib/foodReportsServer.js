// Kitchen and meal reports on the server: Infant Feeding Report, Meal
// Production Record and Meal Claim (client request 2026-10-23).

import {
  MEAL_LETTERS,
  ageInMonths,
  childrenGroupFor,
  claimAge,
  dateKeysBetween,
  localDateKey,
  logTime,
  mealKeyForLog,
  mealLabel,
} from "@/lib/foodReports";
import { dbDate } from "@/lib/menuAccess";
import { COMPONENTS, MEALS, ageGroupsFor, componentsFor } from "@/lib/menuPlan";
import prisma from "@/lib/prisma";

const childName = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim();

/** Activity logs are bucketed by the server's local day. */
function localRange(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

function formulaOf(child) {
  const plan = child.feedingPlan && typeof child.feedingPlan === "object" ? child.feedingPlan : {};
  return String(plan.formula || plan.milk || plan.milkType || "").trim();
}

/** Every child the center has had (the report can be pulled from history). */
export async function feedingReportChildren(centerId) {
  const children = await prisma.child.findMany({
    where: { centerId },
    select: { id: true, firstName: true, lastName: true, birthDate: true, enrollmentEndDate: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return children.map((c) => ({ id: c.id, name: childName(c), birthDate: c.birthDate, enrolled: !c.enrollmentEndDate || c.enrollmentEndDate >= new Date() }));
}

/**
 * Individual Infant Feeding Report: bottles (time, offered, consumed) from the
 * teacher's Log Activity, meals from the meal logs with the components and
 * amounts from the kitchen's Infant Portions, and milk/formula from the
 * child's feeding plan.
 */
export async function infantFeedingReport({ centerId, childId, from, to }) {
  const child = await prisma.child.findFirst({
    where: { id: childId, centerId },
    select: { id: true, firstName: true, lastName: true, birthDate: true, feedingPlan: true, classRoom: { select: { name: true } } },
  });
  if (!child) return null;
  const [logs, portions] = await Promise.all([
    prisma.activityLog.findMany({
      where: { childId, type: { in: ["BOTTLE", "MEAL", "SNACK"] }, createdAt: localRange(from, to) },
      orderBy: { createdAt: "asc" },
    }),
    prisma.infantPortion.findMany({ where: { childId, date: { gte: dbDate(from), lte: dbDate(to) } } }),
  ]);
  const menu = portions.length
    ? await prisma.menuItem.findMany({
        where: { centerId, kind: { in: ["SERVED", "PLANNED"] }, date: { gte: dbDate(from), lte: dbDate(to) } },
      })
    : [];
  const itemFor = (date, meal, ageGroup, component) => {
    const rows = menu.filter((m) => m.date.toISOString().slice(0, 10) === date && m.meal === meal && m.ageGroup === ageGroup && m.component === component);
    return (rows.find((m) => m.kind === "SERVED") || rows.find((m) => m.kind === "PLANNED"))?.item || "";
  };
  const formula = formulaOf(child);

  const days = {};
  const dayOf = (key) => (days[key] ||= { date: key, rows: [] });
  for (const log of logs) {
    const details = log.details && typeof log.details === "object" ? log.details : {};
    const time = logTime(log);
    if (log.type === "BOTTLE") {
      dayOf(localDateKey(log.createdAt)).rows.push({
        time: time.label,
        minutes: time.minutes,
        activity: "Bottle",
        milk: details.formula || formula || "Bottle",
        offered: details.amount || "",
        consumed: details.consumed || "",
        components: [],
      });
    } else {
      const meal = mealKeyForLog(details);
      const day = dayOf(localDateKey(log.createdAt));
      if (meal && day.rows.some((r) => r.meal === meal)) continue;
      day.rows.push({ time: time.label, minutes: time.minutes, meal, activity: meal ? mealLabel(meal) : details.meal || "Meal", milk: "", offered: "", consumed: "", components: [] });
    }
  }
  // Kitchen portions fill in each meal's components (a meal the teacher didn't log still shows).
  const mealOrder = MEALS.map((m) => m.key);
  for (const p of portions) {
    const date = p.date.toISOString().slice(0, 10);
    const day = dayOf(date);
    let row = day.rows.find((r) => r.meal === p.meal);
    if (!row) {
      row = { time: "", minutes: 10000 + mealOrder.indexOf(p.meal), meal: p.meal, activity: mealLabel(p.meal), milk: "", offered: "", consumed: "", components: [] };
      day.rows.push(row);
    }
    const order = componentsFor(p.meal, p.ageGroup).indexOf(p.component);
    row.components.push({ order, text: `${itemFor(date, p.meal, p.ageGroup, p.component) || COMPONENTS[p.component]} — ${p.amount}` });
  }
  const list = Object.values(days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      rows: d.rows
        .sort((a, b) => a.minutes - b.minutes)
        .map(({ minutes, meal, components, ...r }) => ({ ...r, components: components.sort((a, b) => a.order - b.order).map((c) => c.text) })),
    }));
  return {
    child: {
      id: child.id,
      name: childName(child),
      birthDate: child.birthDate,
      ageGroup: (() => {
        const months = ageInMonths(child.birthDate, from);
        return months == null ? "" : months < 6 ? "Younger Infants" : months < 12 ? "Older Infants" : `${Math.floor(months / 12)}+ years`;
      })(),
      classroom: child.classRoom?.name || "",
      formula,
    },
    days: list,
    componentColumns: Math.max(2, ...list.flatMap((d) => d.rows.map((r) => r.components.length))),
  };
}

/** Distinct children with a meal log, per day and meal. */
async function mealLogsByDay(centerId, from, to) {
  const logs = await prisma.activityLog.findMany({
    where: { type: { in: ["MEAL", "SNACK"] }, createdAt: localRange(from, to), child: { centerId } },
    select: { childId: true, details: true, createdAt: true },
  });
  const served = {}; // date -> meal -> Set(childId)
  for (const log of logs) {
    const meal = mealKeyForLog(log.details);
    if (!meal) continue;
    const date = localDateKey(log.createdAt);
    ((served[date] ||= {})[meal] ||= new Set()).add(log.childId);
  }
  return served;
}

/**
 * Meal Production Record for one meal: the components actually served (kitchen
 * menu), the planned number served per age group (typed in) and the actual
 * number served (children whose meal the teachers logged).
 */
export async function mealProductionReport({ centerId, meal, from, to }) {
  const center = await prisma.center.findUnique({ where: { id: centerId }, select: { id: true, name: true, mealAgeGroups: true } });
  const groups = ageGroupsFor(center).filter((g) => !g.key.endsWith("Infants"));
  const [menu, planned, served] = await Promise.all([
    prisma.menuItem.findMany({ where: { centerId, meal, kind: "SERVED", date: { gte: dbDate(from), lte: dbDate(to) } } }),
    prisma.mealProductionCount.findMany({ where: { centerId, meal, date: { gte: dbDate(from), lte: dbDate(to) } } }),
    mealLogsByDay(centerId, from, to),
  ]);
  const childIds = [...new Set(Object.values(served).flatMap((byMeal) => [...(byMeal[meal] || [])]))];
  const births = Object.fromEntries(
    (await prisma.child.findMany({ where: { id: { in: childIds } }, select: { id: true, birthDate: true } })).map((c) => [c.id, c.birthDate]),
  );
  const rows = dateKeysBetween(from, to).map((date) => {
    const components = [];
    for (const g of groups) {
      for (const component of componentsFor(meal, g.key)) {
        const item = menu.find((m) => m.date.toISOString().slice(0, 10) === date && m.ageGroup === g.key && m.component === component)?.item;
        if (item && !components.includes(item)) components.push(item);
      }
    }
    const actual = Object.fromEntries(groups.map((g) => [g.key, 0]));
    for (const id of served[date]?.[meal] || []) {
      const key = childrenGroupFor(groups, ageInMonths(births[id], date));
      if (key) actual[key] += 1;
    }
    return {
      date,
      components,
      planned: Object.fromEntries(groups.map((g) => [g.key, planned.find((p) => p.date.toISOString().slice(0, 10) === date && p.ageGroup === g.key)?.planned ?? null])),
      actual,
    };
  });
  return {
    center: { id: center.id, name: center.name },
    meal: { key: meal, label: mealLabel(meal) },
    groups: groups.map((g) => ({ key: g.key, label: g.label.replace(" Years", "") })),
    componentColumns: Math.max(3, ...rows.map((r) => r.components.length)),
    rows,
  };
}

/**
 * Meal Claim: a 1 for every child, day and meal a teacher logged, with totals,
 * and the monthly summary.
 */
export async function mealClaimReport({ centerId, from, to }) {
  const dates = dateKeysBetween(from, to);
  const served = await mealLogsByDay(centerId, from, to);
  const loggedIds = new Set(Object.values(served).flatMap((byMeal) => Object.values(byMeal).flatMap((set) => [...set])));
  const children = await prisma.child.findMany({
    where: {
      centerId,
      OR: [
        { id: { in: [...loggedIds] } },
        {
          AND: [
            { OR: [{ enrollmentStartDate: null }, { enrollmentStartDate: { lte: new Date(`${to}T23:59:59`) } }] },
            { OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: new Date(`${from}T00:00:00`) } }] },
          ],
        },
      ],
    },
    select: { id: true, firstName: true, lastName: true, birthDate: true, classRoom: { select: { name: true } } },
    orderBy: [{ birthDate: "desc" }, { firstName: "asc" }],
  });
  const meals = MEALS.map((m) => m.key);
  const rows = children.map((c) => {
    const cells = {};
    const totals = Object.fromEntries(meals.map((m) => [m, 0]));
    for (const date of dates) {
      for (const meal of meals) {
        if (served[date]?.[meal]?.has(c.id)) {
          cells[`${date}|${meal}`] = 1;
          totals[meal] += 1;
        }
      }
    }
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName || "",
      birthDate: c.birthDate,
      age: claimAge(c.birthDate, to),
      classroom: c.classRoom?.name || "",
      cells,
      totals,
    };
  });
  const dayTotals = {};
  for (const date of dates) for (const meal of meals) dayTotals[`${date}|${meal}`] = served[date]?.[meal]?.size || 0;
  const anyMealDays = dates.filter((d) => meals.some((m) => dayTotals[`${d}|${m}`] > 0));
  const summary = meals.map((meal) => {
    const total = dates.reduce((s, d) => s + dayTotals[`${d}|${meal}`], 0);
    const daysServed = dates.filter((d) => dayTotals[`${d}|${meal}`] > 0).length;
    return { meal, label: mealLabel(meal), total, days: daysServed, average: daysServed ? Math.round((total / daysServed) * 10) / 10 : 0 };
  });
  return {
    dates,
    meals: meals.map((m) => ({ key: m, letter: MEAL_LETTERS[m], label: mealLabel(m) })),
    rows,
    dayTotals,
    anyMealDays,
    summary: {
      childrenOnRoster: children.length,
      daysAnyMealServed: anyMealDays.length,
      meals: summary,
      total: summary.reduce((s, m) => s + m.total, 0),
    },
  };
}
