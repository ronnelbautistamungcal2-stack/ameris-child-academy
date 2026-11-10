import { getSession } from "@/lib/auth";
import { addDaysKey, dayNumbersBetween, isDateKey } from "@/lib/lessonCalendar";
import { classroomAccess, loadCalendar } from "@/lib/lessonPlanAccess";
import { buildActiveRows, rowLabel } from "@/lib/lessonPlanRows";
import { classroomCurriculum, plannedLessons } from "@/lib/curriculumSource";

/**
 * GET /api/v1/lesson-planner/week?centerId=&classRoomId=&start=YYYY-MM-DD
 * The teacher's Weekly Lesson Plan for Monday–Friday from `start`: each date's
 * Lesson Calendar day number and the lessons the Lesson Planner has for that
 * day, by category. `planned` is false until the classroom has a start day.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const { centerId, classRoomId, start } = req.query;
    const access = await classroomAccess(session.user, centerId, classRoomId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!isDateKey(start)) return res.status(400).json({ error: "start must be a YYYY-MM-DD date" });

    const end = addDaysKey(start, 4);
    const calendar = await loadCalendar(String(centerId), String(classRoomId));
    const numbers = dayNumbersBetween(calendar.anchors, calendar.closedDays, start, end);
    const dayList = Object.values(numbers).map((n) => n.day).filter(Boolean);

    // A subscriber classroom shows the Ameris age-group planner it follows
    // (step E); everyone else their own classroom's planner.
    const curriculum = await classroomCurriculum(classRoomId);
    const plan = await plannedLessons(curriculum, dayList, { buildActiveRows, rowLabel });
    const byDay = plan.byDay;

    return res.status(200).json({
      planned: calendar.anchors.length > 0,
      theme: plan.theme,
      rows: plan.rows,
      curriculum: curriculum?.mode || "OWN",
      days: Object.entries(numbers).map(([date, info]) => ({
        date,
        day: info.day,
        closed: info.closed,
        cells: (info.day && byDay[info.day]) || {},
      })),
    });
  } catch (e) {
    console.error("lesson planner week error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
