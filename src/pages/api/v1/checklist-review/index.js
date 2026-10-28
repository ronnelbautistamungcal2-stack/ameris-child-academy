import { getSession, hasAccessToCenter } from "@/lib/auth";
import { checklistReview } from "@/lib/checklistReview";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/v1/checklist-review?centerId=&date=YYYY-MM-DD
 * Checklist Review (admins and coaches): each staff member's checklist
 * completion, missing items and notes for the day.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!["ADMIN", "COACH"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const date = String(req.query.date || "");
  if (!centerId || !DATE.test(date)) return res.status(400).json({ error: "centerId and date (YYYY-MM-DD) are required" });
  if (session.user.role !== "ADMIN" && !(await hasAccessToCenter(session.user.id, centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.status(200).json(await checklistReview(prisma, { centerId, date }));
}
