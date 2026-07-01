import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  if (session.user.role === "PARENT") {
    const linkedChild = await prisma.child.findFirst({
      where: buildParentLinkedChildWhere(session.user.id, { centerId }),
      select: { id: true },
    });
    if (!linkedChild) return res.status(403).json({ error: "Forbidden" });
  } else if (session.user.role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const activities = await prisma.parentInvolvementActivity.findMany({
      where: { centerId, active: true },
      orderBy: { title: "asc" },
    });
    return res.status(200).json(activities);
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can manage involvement activities" });
    }
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const activity = await prisma.parentInvolvementActivity.create({
      data: { centerId, title: String(title).trim(), description: description || null },
    });
    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
