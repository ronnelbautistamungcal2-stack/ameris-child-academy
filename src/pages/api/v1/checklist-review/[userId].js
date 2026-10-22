import { getSession, hasAccessToCenter } from "@/lib/auth";
import { checklistReview } from "@/lib/checklistReview";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/v1/checklist-review/:userId?centerId=&date=YYYY-MM-DD
 * The Staff Checklist Details pop-up: one staff member's items for the day
 * and the Daily Log entries they recorded.
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
  const result = await checklistReview(prisma, { centerId, date, userId: String(req.query.userId) });
  if (!result.row) return res.status(404).json({ error: "Staff member not found at this center" });
  return res.status(200).json(result);
}
