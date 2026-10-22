import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  MAX_DAY_NUMBER,
  addDaysKey,
  dayNumbersBetween,
  isDateKey,
  isSchoolDay,
  toDateKey,
} from "@/lib/lessonCalendar";
import { classroomAccess, dbDate, loadCalendar } from "@/lib/lessonPlanAccess";

const MAX_RANGE_DAYS = 400;

/**
 * GET /api/v1/lesson-calendar?centerId=&classRoomId=&from=&to=
 *     The classroom's day numbers for each date in the range, plus its start
 *     days and the center's closed days.
 * PUT /api/v1/lesson-calendar
 *     { centerId, classRoomId, startDate?, dayNumber?, closedDays: [] }
 *     Admin only ("Set Start Day & Closed Days"). The start day restarts the
 *     count for that classroom only (client answer 2026-10-21) and replaces
 *     any later start days. closedDays replaces the center's closed days from
 *     today on. Nothing before today can change.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const { centerId, classRoomId, from, to } = req.query;
      const access = await classroomAccess(user, centerId, classRoomId);
      if (access.error) return res.status(access.status).json({ error: access.error });
      if (!isDateKey(from) || !isDateKey(to) || from > to || addDaysKey(from, MAX_RANGE_DAYS) < to) {
        return res.status(400).json({ error: `from and to must be dates at most ${MAX_RANGE_DAYS} days apart` });
      }
      const calendar = await loadCalendar(String(centerId), String(classRoomId));
      return res.status(200).json({
        ...calendar,
        today: toDateKey(new Date()),
        days: dayNumbersBetween(calendar.anchors, calendar.closedDays, from, to),
      });
    }

    if (req.method === "PUT") {
      const { centerId, classRoomId, startDate, dayNumber, closedDays } = req.body || {};
      const access = await classroomAccess(user, centerId, classRoomId, { admin: true });
      if (access.error) return res.status(access.status).json({ error: access.error });
      const today = toDateKey(new Date());

      if (startDate !== undefined && startDate !== null && startDate !== "") {
        if (!isDateKey(startDate)) return res.status(400).json({ error: "Choose a start date" });
        if (startDate < today) return res.status(400).json({ error: "The start date cannot be in the past" });
        if (!isSchoolDay(startDate)) return res.status(400).json({ error: "The start date must be a weekday" });
        const n = Number(dayNumber);
        if (!Number.isInteger(n) || n < 1 || n > MAX_DAY_NUMBER) {
          return res.status(400).json({ error: `Day number must be between 1 and ${MAX_DAY_NUMBER}` });
        }
      }
      if (!Array.isArray(closedDays)) return res.status(400).json({ error: "closedDays must be a list of dates" });
      const closed = [...new Set(closedDays)];
      if (closed.some((d) => !isDateKey(d))) return res.status(400).json({ error: "Closed days must be dates" });
      if (closed.some((d) => d < today)) return res.status(400).json({ error: "Closed days cannot be in the past" });

      const classRoomIds = [String(classRoomId)];

      const ops = [
        prisma.lessonClosedDay.deleteMany({ where: { centerId: String(centerId), date: { gte: dbDate(today) } } }),
        prisma.lessonClosedDay.createMany({
          data: closed.map((d) => ({ centerId: String(centerId), date: dbDate(d) })),
          skipDuplicates: true,
        }),
      ];
      if (startDate) {
        for (const id of classRoomIds) {
          ops.push(
            prisma.lessonCalendarAnchor.deleteMany({ where: { classRoomId: id, startDate: { gte: dbDate(startDate) } } }),
            prisma.lessonCalendarAnchor.create({
              data: {
                centerId: String(centerId),
                classRoomId: id,
                startDate: dbDate(startDate),
                dayNumber: Number(dayNumber),
                createdById: user.id,
              },
            }),
          );
        }
      }
      await prisma.$transaction(ops);
      return res.status(200).json({ ok: true, classrooms: classRoomIds.length });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("lesson calendar error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
