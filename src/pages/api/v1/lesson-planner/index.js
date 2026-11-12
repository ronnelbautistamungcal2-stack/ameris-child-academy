import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cellKey, plannerMeta, plannerTarget, updatePlannerMeta } from "@/lib/curriculumPlans";

// Client sheet 10-29 row 65: up to 365 days (was 200).
const MAX_DAYS = 365;
const MAX_TITLE = 200;

function cellOut(cell) {
  return { day: cell.day, rowIndex: cell.rowIndex, lessonId: cell.lessonId, title: cell.title };
}

async function snapshot(target) {
  const [meta, cells] = await Promise.all([
    plannerMeta(target),
    prisma.lessonPlanCell.findMany({ where: { [target.field]: target.id }, orderBy: [{ day: "asc" }, { rowIndex: "asc" }] }),
  ]);
  return {
    theme: meta.theme,
    dayCount: meta.dayCount,
    cells: cells.map(cellOut),
    // A bank lesson is checked as used once it is in this planner.
    usedLessonIds: [...new Set(cells.map((c) => c.lessonId).filter(Boolean))],
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
 * GET /api/v1/lesson-planner?centerId=&planId=   (or &classRoomId= for a
 *     classroom's own planner) Theme, number of day columns, the lesson in
 *     each Day × category cell, and the bank lessons it uses.
 * PUT /api/v1/lesson-planner  { centerId, planId | classRoomId, action, ... }  (admin)
 *     setCell { day, rowIndex, lessonId?, title? }  blank clears the cell
 *     moveCell { from: {day,rowIndex}, to: {day,rowIndex} }  swaps if taken
 *     setTheme { theme }, addDay, deleteDay { day }
 *     Responds with the whole planner.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const access = await plannerTarget(user, req.query);
      if (access.error) return res.status(access.status).json({ error: access.error });
      return res.status(200).json(await snapshot(access.target));
    }

    if (req.method !== "PUT") {
      res.setHeader("Allow", ["GET", "PUT"]);
      return res.status(405).end();
    }

    const body = req.body || {};
    const access = await plannerTarget(user, body, { admin: true });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { target } = access;
    const owner = { [target.field]: target.id };
    const column = Prisma.raw(`"${target.field}"`); // our own field name, never user input
    const meta = await plannerMeta(target);
    const bad = (error) => res.status(400).json({ error });

    switch (body.action) {
      case "setTheme": {
        const theme = String(body.theme ?? "").trim().slice(0, 120) || null;
        await updatePlannerMeta(target, { theme });
        break;
      }
      case "addDay": {
        if (meta.dayCount >= MAX_DAYS) return bad(`A planner can have at most ${MAX_DAYS} days`);
        await updatePlannerMeta(target, { dayCount: { increment: 1 } });
        break;
      }
      case "deleteDay": {
        const day = Number(body.day);
        if (!Number.isInteger(day) || day < 1 || day > meta.dayCount) return bad("Choose a day to delete");
        if (meta.dayCount <= 1) return bad("A planner needs at least one day");
        // Later days move left one column; done in two steps so the unique
        // (planner, day, row) key never collides mid-update.
        await prisma.$transaction([
          prisma.lessonPlanCell.deleteMany({ where: { ...owner, day } }),
          prisma.$executeRaw`UPDATE "LessonPlanCell" SET "day" = -"day" WHERE ${column} = ${target.id} AND "day" > ${day}`,
          prisma.$executeRaw`UPDATE "LessonPlanCell" SET "day" = -"day" - 1, "updatedAt" = NOW() WHERE ${column} = ${target.id} AND "day" < 0`,
          target.field === "planId"
            ? prisma.curriculumPlan.update({ where: { id: target.id }, data: { dayCount: { decrement: 1 } } })
            : prisma.lessonPlanner.update({ where: { classRoomId: target.id }, data: { dayCount: { decrement: 1 } } }),
        ]);
        break;
      }
      case "setCell": {
        const at = slot(body, meta.dayCount);
        if (!at) return bad("Choose a day and category");
        let lessonId = body.lessonId ? String(body.lessonId) : null;
        let title = String(body.title ?? "").trim().slice(0, MAX_TITLE);
        if (lessonId) {
          const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, centerId: target.centerId }, select: { title: true } });
          if (!lesson) return bad("That lesson is not in this center's bank");
          title = title || lesson.title;
        }
        if (!title) {
          await prisma.lessonPlanCell.deleteMany({ where: { ...owner, ...at } });
        } else {
          await prisma.lessonPlanCell.upsert({
            where: cellKey(target, at),
            create: { centerId: target.centerId, ...owner, ...at, lessonId, title },
            update: { lessonId, title },
          });
        }
        break;
      }
      case "moveCell": {
        const from = slot(body.from, meta.dayCount);
        const to = slot(body.to, meta.dayCount);
        if (!from || !to) return bad("Choose where to move the lesson");
        if (from.day === to.day && from.rowIndex === to.rowIndex) break;
        const [source, dest] = await Promise.all([
          prisma.lessonPlanCell.findUnique({ where: cellKey(target, from) }),
          prisma.lessonPlanCell.findUnique({ where: cellKey(target, to) }),
        ]);
        if (!source) return bad("There is no lesson there to move");
        const ops = [];
        if (dest) ops.push(prisma.lessonPlanCell.update({ where: { id: dest.id }, data: { day: -1, rowIndex: -1 } }));
        ops.push(prisma.lessonPlanCell.update({ where: { id: source.id }, data: to }));
        if (dest) ops.push(prisma.lessonPlanCell.update({ where: { id: dest.id }, data: from }));
        await prisma.$transaction(ops);
        break;
      }
      default:
        return bad("Unknown action");
    }

    return res.status(200).json(await snapshot(target));
  } catch (e) {
    console.error("lesson planner error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
