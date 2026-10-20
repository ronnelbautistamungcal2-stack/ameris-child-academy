import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { classroomAccess } from "@/lib/lessonPlanAccess";

const MAX_DAYS = 200;
const MAX_TITLE = 200;

function cellOut(cell) {
  return { day: cell.day, rowIndex: cell.rowIndex, lessonId: cell.lessonId, title: cell.title };
}

function plannerFor(classRoom) {
  return prisma.lessonPlanner.upsert({
    where: { classRoomId: classRoom.id },
    create: { classRoomId: classRoom.id, centerId: classRoom.centerId },
    update: {},
  });
}

async function snapshot(classRoom) {
  const [planner, cells, used] = await Promise.all([
    plannerFor(classRoom),
    prisma.lessonPlanCell.findMany({ where: { classRoomId: classRoom.id }, orderBy: [{ day: "asc" }, { rowIndex: "asc" }] }),
    prisma.lessonUsedMark.findMany({ where: { classRoomId: classRoom.id }, select: { lessonId: true } }),
  ]);
  return {
    theme: planner.theme || "",
    dayCount: planner.dayCount,
    cells: cells.map(cellOut),
    usedLessonIds: used.map((u) => u.lessonId),
  };
}

function slot(value, dayCount) {
  const day = Number(value?.day);
  const rowIndex = Number(value?.rowIndex);
  if (!Number.isInteger(day) || day < 1 || day > dayCount) return null;
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > 999) return null;
  return { day, rowIndex };
}

/**
 * GET /api/v1/lesson-planner?centerId=&classRoomId=
 *     The classroom's Lesson Planner: theme, number of day columns, the lesson
 *     in each Day × category cell, and the lessons ticked as used.
 * PUT /api/v1/lesson-planner  { centerId, classRoomId, action, ... }  (admin)
 *     setCell { day, rowIndex, lessonId?, title? }  blank clears the cell
 *     moveCell { from: {day,rowIndex}, to: {day,rowIndex} }  swaps if taken
 *     setTheme { theme }, addDay, deleteDay { day }, markUsed { lessonId, used }
 *     Responds with the whole planner.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const access = await classroomAccess(user, req.query.centerId, req.query.classRoomId);
      if (access.error) return res.status(access.status).json({ error: access.error });
      return res.status(200).json(await snapshot(access.classRoom));
    }

    if (req.method !== "PUT") {
      res.setHeader("Allow", ["GET", "PUT"]);
      return res.status(405).end();
    }

    const body = req.body || {};
    const access = await classroomAccess(user, body.centerId, body.classRoomId, { admin: true });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { classRoom } = access;
    const classRoomId = classRoom.id;
    const planner = await plannerFor(classRoom);
    const bad = (error) => res.status(400).json({ error });

    switch (body.action) {
      case "setTheme": {
        const theme = String(body.theme ?? "").trim().slice(0, 120) || null;
        await prisma.lessonPlanner.update({ where: { id: planner.id }, data: { theme } });
        break;
      }
      case "addDay": {
        if (planner.dayCount >= MAX_DAYS) return bad(`A planner can have at most ${MAX_DAYS} days`);
        await prisma.lessonPlanner.update({ where: { id: planner.id }, data: { dayCount: { increment: 1 } } });
        break;
      }
      case "deleteDay": {
        const day = Number(body.day);
        if (!Number.isInteger(day) || day < 1 || day > planner.dayCount) return bad("Choose a day to delete");
        if (planner.dayCount <= 1) return bad("A planner needs at least one day");
        // Later days move left one column; done in two steps so the unique
        // (classroom, day, row) key never collides mid-update.
        await prisma.$transaction([
          prisma.lessonPlanCell.deleteMany({ where: { classRoomId, day } }),
          prisma.$executeRaw`UPDATE "LessonPlanCell" SET "day" = -"day" WHERE "classRoomId" = ${classRoomId} AND "day" > ${day}`,
          prisma.$executeRaw`UPDATE "LessonPlanCell" SET "day" = -"day" - 1, "updatedAt" = NOW() WHERE "classRoomId" = ${classRoomId} AND "day" < 0`,
          prisma.lessonPlanner.update({ where: { id: planner.id }, data: { dayCount: { decrement: 1 } } }),
        ]);
        break;
      }
      case "setCell": {
        const at = slot(body, planner.dayCount);
        if (!at) return bad("Choose a day and category");
        let lessonId = body.lessonId ? String(body.lessonId) : null;
        let title = String(body.title ?? "").trim().slice(0, MAX_TITLE);
        if (lessonId) {
          const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, centerId: classRoom.centerId }, select: { title: true } });
          if (!lesson) return bad("That lesson is not in this center's bank");
          title = title || lesson.title;
        }
        const where = { classRoomId_day_rowIndex: { classRoomId, ...at } };
        if (!title) {
          await prisma.lessonPlanCell.deleteMany({ where: { classRoomId, ...at } });
        } else {
          await prisma.lessonPlanCell.upsert({
            where,
            create: { centerId: classRoom.centerId, classRoomId, ...at, lessonId, title },
            update: { lessonId, title },
          });
        }
        break;
      }
      case "moveCell": {
        const from = slot(body.from, planner.dayCount);
        const to = slot(body.to, planner.dayCount);
        if (!from || !to) return bad("Choose where to move the lesson");
        if (from.day === to.day && from.rowIndex === to.rowIndex) break;
        const [source, target] = await Promise.all([
          prisma.lessonPlanCell.findUnique({ where: { classRoomId_day_rowIndex: { classRoomId, ...from } } }),
          prisma.lessonPlanCell.findUnique({ where: { classRoomId_day_rowIndex: { classRoomId, ...to } } }),
        ]);
        if (!source) return bad("There is no lesson there to move");
        const ops = [];
        if (target) ops.push(prisma.lessonPlanCell.update({ where: { id: target.id }, data: { day: -1, rowIndex: -1 } }));
        ops.push(prisma.lessonPlanCell.update({ where: { id: source.id }, data: to }));
        if (target) ops.push(prisma.lessonPlanCell.update({ where: { id: target.id }, data: from }));
        await prisma.$transaction(ops);
        break;
      }
      case "markUsed": {
        const lessonId = String(body.lessonId || "");
        const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, centerId: classRoom.centerId }, select: { id: true } });
        if (!lesson) return bad("That lesson is not in this center's bank");
        if (body.used) {
          await prisma.lessonUsedMark.upsert({
            where: { classRoomId_lessonId: { classRoomId, lessonId } },
            create: { classRoomId, lessonId },
            update: {},
          });
        } else {
          await prisma.lessonUsedMark.deleteMany({ where: { classRoomId, lessonId } });
        }
        break;
      }
      default:
        return bad("Unknown action");
    }

    return res.status(200).json(await snapshot(classRoom));
  } catch (e) {
    console.error("lesson planner error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
