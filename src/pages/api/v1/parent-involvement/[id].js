import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageInvolvement } from "@/lib/parentInvolvementServer";

/**
 * DELETE /api/v1/parent-involvement/:id   a Volunteer Tracking row (staff who
 * run events at the center), or a parent's own entry.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).end();
  }
  const entry = await prisma.parentInvolvement.findUnique({ where: { id: String(req.query.id) }, include: { activity: { select: { centerId: true } } } });
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  const own = session.user.role === "PARENT" && entry.parentId === session.user.id;
  if (!own && !(await canManageInvolvement(session.user, entry.activity.centerId))) return res.status(403).json({ error: "Forbidden" });
  await prisma.parentInvolvement.delete({ where: { id: entry.id } });
  return res.status(204).end();
}
