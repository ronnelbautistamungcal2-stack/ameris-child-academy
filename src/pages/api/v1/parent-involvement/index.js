import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isChildLinkedToParent } from "@/lib/child-parent-links";
import { INVOLVEMENT_NOTES_MAX, openSignupWhere, parseInvolvementWindow } from "@/lib/parentInvolvement";

const CHILD_SELECT = { id: true, firstName: true, lastName: true };

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId, parentId } = req.query;

  if (req.method === "GET") {
    if (!["ADMIN", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const where = {};
    if (session.user.role === "PARENT") {
      where.parentId = session.user.id;
    } else {
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (parentId) where.parentId = parentId;
      where.activity = { centerId };
    }

    const involvements = await prisma.parentInvolvement.findMany({
      where,
      include: {
        activity: { select: { id: true, title: true } },
        parent: { select: { id: true, name: true, email: true } },
        child: { select: CHILD_SELECT },
        children: { select: CHILD_SELECT },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    return res.status(200).json(involvements);
  }

  if (req.method === "POST") {
    if (session.user.role !== "PARENT") {
      return res.status(403).json({ error: "Only parents can log involvement" });
    }

    const { activityId, childIds, notes, date, startTime, endTime } = req.body || {};
    const kind = req.body?.kind === "SIGNUP" ? "SIGNUP" : "LOG";
    if (!activityId) return res.status(400).json({ error: "activityId is required" });

    const ids = [...new Set(Array.isArray(childIds) ? childIds.filter(Boolean) : [])];
    if (!ids.length) return res.status(400).json({ error: "Select at least one child" });

    const window = parseInvolvementWindow({ date, startTime, endTime });
    if (window.error) return res.status(400).json({ error: window.error });

    const cleanNotes = notes ? String(notes).trim() : "";
    if (cleanNotes.length > INVOLVEMENT_NOTES_MAX) {
      return res.status(400).json({ error: `Notes must be ${INVOLVEMENT_NOTES_MAX} characters or fewer` });
    }

    const activity = await prisma.parentInvolvementActivity.findUnique({ where: { id: activityId } });
    if (!activity || !activity.active) return res.status(404).json({ error: "Activity not found" });

    const children = await prisma.child.findMany({
      where: { id: { in: ids } },
      include: { guardians: { select: { guardianId: true } } },
    });
    const allLinked =
      children.length === ids.length &&
      children.every((c) => c.centerId === activity.centerId && isChildLinkedToParent(c, session.user.id));
    if (!allLinked) return res.status(403).json({ error: "Forbidden" });

    if (kind === "SIGNUP") {
      const open = await prisma.parentInvolvement.findMany({
        where: openSignupWhere(activity.id),
        select: { parentId: true },
      });
      if (open.some((s) => s.parentId === session.user.id)) {
        return res.status(409).json({ error: "You are already signed up for this opportunity" });
      }
      if (activity.capacity != null && open.length >= activity.capacity) {
        return res.status(409).json({ error: "This opportunity is full" });
      }
    }

    const record = await prisma.parentInvolvement.create({
      data: {
        kind,
        activityId,
        parentId: session.user.id,
        childId: ids.length === 1 ? ids[0] : null,
        children: { connect: ids.map((id) => ({ id })) },
        notes: cleanNotes || null,
        occurredAt: window.start,
        endedAt: window.end,
        hours: window.hours,
      },
      include: {
        activity: { select: { id: true, title: true } },
        child: { select: CHILD_SELECT },
        children: { select: CHILD_SELECT },
      },
    });
    return res.status(201).json(record);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
