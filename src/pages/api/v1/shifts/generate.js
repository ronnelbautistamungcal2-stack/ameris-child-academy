import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageShifts, roleLabel, userRoles } from "@/lib/roles";
import { EMPLOYED_WHERE } from "@/lib/employment";

function parseMonday(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUTC(d, n) {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }
    if (!canManageShifts(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId, weekStart } = req.body || {};
    if (!centerId || !weekStart) {
      return res.status(400).json({ error: "centerId and weekStart are required" });
    }

    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const monday = parseMonday(weekStart);
    if (!monday) return res.status(400).json({ error: "Invalid weekStart" });

    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysUTC(monday, i));

    const staff = await prisma.user.findMany({
      where: { centers: { some: { centerId } }, ...EMPLOYED_WHERE },
      select: { id: true, role: true, roles: true, weeklySchedules: true },
    });

    const staffWithSchedules = staff.filter((u) => u.weeklySchedules.length > 0);
    if (!staffWithSchedules.length) {
      return res.status(200).json({ generated: 0 });
    }

    // A week already filled from someone's schedule is filled again only when
    // their schedule changed since, so shifts deleted by hand stay deleted
    // (client sheet 10-29 (11), row 68: only some schedules came over).
    const already = await prisma.shiftScheduleGeneration.findMany({
      where: {
        centerId,
        weekStart: monday,
        userId: { in: staffWithSchedules.map((u) => u.id) },
      },
      select: { userId: true, createdAt: true },
    });
    const generatedAt = new Map(already.map((a) => [a.userId, a.createdAt]));
    const changedSince = (u) => u.weeklySchedules.some((b) => b.updatedAt > generatedAt.get(u.id) || b.createdAt > generatedAt.get(u.id));
    const toGenerate = staffWithSchedules.filter((u) => !generatedAt.has(u.id) || changedSince(u));
    if (!toGenerate.length) {
      return res.status(200).json({ generated: 0 });
    }

    // Days that already have a shift (set or edited by hand) are left as they are.
    const existing = await prisma.shiftSchedule.findMany({
      where: { centerId, userId: { in: toGenerate.map((u) => u.id) }, date: { gte: weekDates[0], lte: weekDates[6] } },
      select: { userId: true, date: true },
    });
    const taken = new Set(existing.map((s) => `${s.userId}|${s.date.toISOString().slice(0, 10)}`));

    const shiftsToCreate = [];
    for (const user of toGenerate) {
      // The position is the person's own role, not always Teacher.
      const role = userRoles(user).find((r) => !["PARENT", "GLOBAL_ADMIN"].includes(r)) || user.role;
      for (const block of user.weeklySchedules) {
        for (const date of weekDates) {
          if (block.daysOfWeek.includes(date.getUTCDay()) && !taken.has(`${user.id}|${date.toISOString().slice(0, 10)}`)) {
            shiftsToCreate.push({
              centerId,
              userId: user.id,
              date,
              startTime: block.startTime,
              endTime: block.endTime,
              position: roleLabel(role),
            });
          }
        }
      }
    }

    if (shiftsToCreate.length) {
      await prisma.shiftSchedule.createMany({ data: shiftsToCreate, skipDuplicates: true });
    }

    // Mark the week as filled now (createdAt is when it was last filled).
    await prisma.shiftScheduleGeneration.deleteMany({ where: { centerId, weekStart: monday, userId: { in: toGenerate.map((u) => u.id) } } });
    await prisma.shiftScheduleGeneration.createMany({
      data: toGenerate.map((u) => ({ userId: u.id, centerId, weekStart: monday })),
      skipDuplicates: true,
    });

    return res.status(200).json({ generated: shiftsToCreate.length });
  } catch (e) {
    console.error("shifts/generate error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
