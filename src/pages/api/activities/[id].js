import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true, recordedBy: true },
    });

    if (!activity) return res.status(404).json({ error: "Activity not found" });

    // Parent can only see their own child's activities
    if (
      session.user.role === "PARENT" &&
      activity.child.parentId !== session.user.id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(200).json(activity);
  }

  if (req.method === "PUT") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can edit activity logs" });
    }

    if (session.user.role === "TEACHER") {
      const ok = await hasAccessToCenter(session.user.id, activity.child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const { type, notes, details } = req.body || {};
    const data = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "type")) data.type = type;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "notes")) data.notes = notes;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "details")) data.details = details;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "No changes submitted" });
    }

    const updated = await prisma.activityLog.update({
      where: { id },
      data,
      include: { child: true, recordedBy: true },
    });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can delete activity logs" });
    }

    if (session.user.role === "TEACHER") {
      const ok = await hasAccessToCenter(session.user.id, activity.child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.activityLog.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
