import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseEvent } from "@/lib/parentInvolvement";
import { canManageInvolvement } from "@/lib/parentInvolvementServer";

/**
 * PUT    /api/v1/parent-involvement/activities/:id   Edit Event (whole event)
 * DELETE /api/v1/parent-involvement/activities/:id   hides the event (history kept)
 * Admins, and HR and coaches at the event's center.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const activity = await prisma.parentInvolvementActivity.findUnique({ where: { id: String(req.query.id) } });
  if (!activity) return res.status(404).json({ error: "Event not found" });
  if (!(await canManageInvolvement(session.user, activity.centerId))) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PUT") {
    const parsed = parseEvent(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const updated = await prisma.parentInvolvementActivity.update({ where: { id: activity.id }, data: parsed.data });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await prisma.parentInvolvementActivity.update({ where: { id: activity.id }, data: { active: false } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
