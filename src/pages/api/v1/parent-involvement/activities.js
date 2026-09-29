import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { activityData, openSignupWhere } from "@/lib/parentInvolvement";

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
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }, { title: "asc" }],
    });
    const ids = activities.map((a) => a.id);
    const signups = ids.length
      ? await prisma.parentInvolvement.findMany({
          where: openSignupWhere(ids),
          select: { activityId: true, parentId: true },
        })
      : [];
    return res.status(200).json(
      activities.map((a) => {
        const taken = signups.filter((s) => s.activityId === a.id);
        return {
          ...a,
          signedUpCount: taken.length,
          spotsLeft: a.capacity == null ? null : Math.max(0, a.capacity - taken.length),
          signedUp: taken.some((s) => s.parentId === session.user.id),
        };
      }),
    );
  }

  if (req.method === "POST") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can manage involvement activities" });
    }
    const { title } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const activity = await prisma.parentInvolvementActivity.create({
      data: { centerId, title: String(title).trim(), ...activityData(req.body) },
    });
    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
