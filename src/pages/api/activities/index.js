import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitActivityLog } from "@/lib/socket";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { childId, type } = req.query;

  if (req.method === "GET") {
    // List activity logs for a child
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      if (session.user.role === "PARENT") {
        const child = await prisma.child.findUnique({
          where: { id: childId },
        });
        if (!child || child.parentId !== session.user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const activities = await prisma.activityLog.findMany({
      where: {
        childId: childId || undefined,
        type: type || undefined,
      },
      include: { child: true, recordedBy: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(activities);
  }

  if (req.method === "POST") {
    // Create activity log (teachers/admins only)
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({ error: "Only teachers and admins can log activities" });
    }

    const { childId: cId, type: actType, details, notes, createdAt } = req.body;

    if (!cId || !actType) {
      return res.status(400).json({ error: "childId and type required" });
    }

    // Prevent backdating unless admin
    const logDate = createdAt ? new Date(createdAt) : new Date();
    const isBackdated = logDate < new Date(Date.now() - 60000); // older than 1 minute
    if (isBackdated && session.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Teachers cannot backdate activity logs" });
    }

    const activity = await prisma.activityLog.create({
      data: {
        childId: cId,
        type: actType,
        details: details || null,
        notes,
        recordedById: session.user.id,
        isBackdated,
        createdAt: logDate,
      },
      include: { child: true, recordedBy: true },
    });

    // Get child's center to emit socket event
    const child = await prisma.child.findUnique({ where: { id: cId } });
    if (child) {
      emitActivityLog(child.centerId, activity);
    }

    return res.status(201).json(activity);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
