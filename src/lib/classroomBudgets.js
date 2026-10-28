// Classroom budgets (client requests 2026-10-02 and 2026-10-14): only admins
// add budgets; admins and coaches enter expenses. A budget covers one period
// (week, month, quarter or year); with auto-renew the next period is created
// with the same amount once the current one has ended.

import { hasAccessToCenter } from "@/lib/auth";
import { BUDGET_PERIODS } from "@/lib/budgetPeriods";
import prisma from "@/lib/prisma";

export { BUDGET_PERIODS };

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of a DATE column value (stored at UTC midnight). */
export function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function dbDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

/** The last day of a period starting on `start` ("YYYY-MM-DD"). */
export function periodEnd(period, start) {
  const d = dbDate(start);
  if (period === "WEEK") return dateKey(new Date(d.getTime() + 6 * DAY));
  const months = period === "YEAR" ? 12 : period === "QUARTER" ? 3 : 1;
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return dateKey(new Date(next.getTime() - DAY));
}

export function nextStart(end) {
  return dateKey(new Date(dbDate(end).getTime() + DAY));
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Who may do what with a center's budgets. */
export async function budgetAccess(user, centerId) {
  if (!centerId) return { ok: false, status: 400, error: "centerId is required" };
  if (user.role === "ADMIN") return { ok: true, canManage: true, canSpend: true };
  if (user.role === "COACH" && (await hasAccessToCenter(user.id, centerId))) return { ok: true, canManage: false, canSpend: true };
  return { ok: false, status: 403, error: "Forbidden" };
}

/**
 * Create the next period for every auto-renewing budget at the center whose
 * latest period has ended, up to the period covering today.
 */
export async function renewBudgets(centerId, today = todayKey()) {
  const budgets = await prisma.classroomBudget.findMany({
    where: { centerId },
    select: { id: true, classRoomId: true, period: true, startDate: true, endDate: true, autoRenew: true, allocatedAmount: true, notes: true },
    orderBy: { startDate: "asc" },
  });
  const latest = {};
  for (const b of budgets) {
    const prev = latest[b.classRoomId];
    if (!prev || b.endDate > prev.endDate) latest[b.classRoomId] = b;
  }
  let created = 0;
  for (const b of Object.values(latest)) {
    if (!b.autoRenew) continue;
    // The periods between the old one and today; only the newest keeps renewing.
    const periods = [];
    let end = dateKey(b.endDate);
    while (end < today && periods.length < 120) {
      const start = nextStart(end);
      end = periodEnd(b.period, start);
      periods.push({ start, end });
    }
    if (!periods.length) continue;
    // Claiming the old period first means two page loads can't both renew it.
    const added = await prisma.$transaction(async (tx) => {
      const claimed = await tx.classroomBudget.updateMany({ where: { id: b.id, autoRenew: true }, data: { autoRenew: false } });
      if (!claimed.count) return 0;
      for (const [i, p] of periods.entries()) {
        await tx.classroomBudget.create({
          data: {
            centerId,
            classRoomId: b.classRoomId,
            period: b.period,
            startDate: dbDate(p.start),
            endDate: dbDate(p.end),
            autoRenew: i === periods.length - 1,
            allocatedAmount: b.allocatedAmount,
            notes: b.notes,
          },
        });
      }
      return periods.length;
    });
    created += added;
  }
  return created;
}

/** Another budget of the classroom overlapping start..end, if any. */
export function findOverlap(classRoomId, start, end, exceptId) {
  return prisma.classroomBudget.findFirst({
    where: {
      classRoomId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      startDate: { lte: dbDate(end) },
      endDate: { gte: dbDate(start) },
    },
    select: { id: true, startDate: true, endDate: true },
  });
}

export function serializeBudget(b) {
  const expenses = b.expenses || [];
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { ...b, startDate: dateKey(b.startDate), endDate: dateKey(b.endDate), spent, remaining: b.allocatedAmount - spent };
}
