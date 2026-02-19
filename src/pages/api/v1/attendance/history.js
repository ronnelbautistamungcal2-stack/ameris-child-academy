import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTeacherClassIds } from "@/lib/teacherScope";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "PARENT"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { childId, centerId, from, to } = req.query;

  if (!childId && !centerId) {
    return res.status(400).json({ error: "childId or centerId is required" });
  }

  try {
    const where = {};

    if (childId) {
      const child = await prisma.child.findUnique({
        where: { id: childId },
        select: { id: true, centerId: true, parentId: true, classRoomId: true },
      });
      if (!child) return res.status(404).json({ error: "Child not found" });

      if (role === "PARENT") {
        if (child.parentId !== session.user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else if (role === "TEACHER") {
        const ok = await hasAccessToCenter(session.user.id, child.centerId);
        if (!ok) return res.status(403).json({ error: "Forbidden" });
      }

      where.childId = childId;
    } else if (centerId) {
      if (role === "PARENT") {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (role !== "ADMIN") {
        const ok = await hasAccessToCenter(session.user.id, centerId);
        if (!ok) return res.status(403).json({ error: "Forbidden" });
      }

      where.centerId = centerId;

      if (role === "TEACHER") {
        const classIds = await getTeacherClassIds(session.user.id, centerId);
        if (classIds.length) {
          where.child = { classRoomId: { in: classIds } };
        } else {
          return res.status(200).json([]);
        }
      }
    }

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      if (from && (!fromDate || Number.isNaN(fromDate.getTime()))) {
        return res.status(400).json({ error: "Invalid from date" });
      }
      if (to && (!toDate || Number.isNaN(toDate.getTime()))) {
        return res.status(400).json({ error: "Invalid to date" });
      }
      where.day = {};
      if (fromDate) where.day.gte = fromDate;
      if (toDate) where.day.lte = toDate;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classRoomId: true,
          },
        },
      },
      orderBy: { day: "desc" },
      take: 2000,
    });

    return res.status(200).json(records);
  } catch (err) {
    console.error("[attendance history GET]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
