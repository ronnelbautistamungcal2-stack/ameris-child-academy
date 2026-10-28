import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The checklist a teacher fills out on a day (client request 2026-10-02):
 * a teacher with more than one checklist picks one, and only that one counts
 * toward their grade.
 * GET /api/v1/daily-checklists/choice?date=YYYY-MM-DD  -> { checklistId }
 * PUT /api/v1/daily-checklists/choice { date, checklistId }
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const userId = session.user.id;

  if (req.method === "GET") {
    const date = String(req.query.date || "");
    if (!DATE.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    const choice = await prisma.dailyChecklistChoice.findUnique({
      where: { userId_date: { userId, date: new Date(date) } },
      select: { checklistId: true },
    });
    return res.status(200).json({ checklistId: choice?.checklistId || null });
  }

  if (req.method === "PUT") {
    const date = String(req.body?.date || "");
    const checklistId = String(req.body?.checklistId || "");
    if (!DATE.test(date) || !checklistId) {
      return res.status(400).json({ error: "date and checklistId are required" });
    }
    const checklist = await prisma.dailyChecklist.findUnique({ where: { id: checklistId }, select: { centerId: true } });
    if (!checklist) return res.status(404).json({ error: "Checklist not found" });
    if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(userId, checklist.centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const day = new Date(date);
    const choice = await prisma.dailyChecklistChoice.upsert({
      where: { userId_date: { userId, date: day } },
      update: { checklistId },
      create: { userId, date: day, checklistId },
    });
    return res.status(200).json({ checklistId: choice.checklistId });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
