import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId, weekStart } = req.body || {};
    if (!centerId || !weekStart) {
      return res.status(400).json({ error: "centerId and weekStart are required" });
    }

    const monday = parseMonday(weekStart);
    if (!monday) return res.status(400).json({ error: "Invalid weekStart" });

    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysUTC(monday, i));

    const staff = await prisma.user.findMany({
      where: { centers: { some: { centerId } } },
      select: { id: true, weeklySchedules: true },
    });

    const staffWithSchedules = staff.filter((u) => u.weeklySchedules.length > 0);
    if (!staffWithSchedules.length) {
      return res.status(200).json({ generated: 0 });
    }

    const already = await prisma.shiftScheduleGeneration.findMany({
      where: {
        centerId,
        weekStart: monday,
        userId: { in: staffWithSchedules.map((u) => u.id) },
      },
      select: { userId: true },
    });
    const alreadySet = new Set(already.map((a) => a.userId));

    const toGenerate = staffWithSchedules.filter((u) => !alreadySet.has(u.id));
    if (!toGenerate.length) {
      return res.status(200).json({ generated: 0 });
    }

    const shiftsToCreate = [];
    for (const user of toGenerate) {
      for (const block of user.weeklySchedules) {
        for (const date of weekDates) {
          if (block.daysOfWeek.includes(date.getUTCDay())) {
            shiftsToCreate.push({
              centerId,
              userId: user.id,
              date,
              startTime: block.startTime,
              endTime: block.endTime,
              position: "Teacher",
            });
          }
        }
      }
    }

    if (shiftsToCreate.length) {
      await prisma.shiftSchedule.createMany({ data: shiftsToCreate, skipDuplicates: true });
    }

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
