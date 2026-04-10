import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherCanAccessClass, teacherChildFilter } from "@/lib/teacherScope";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { childId, centerId } = req.query;

  if (req.method === "GET") {
    const role = session.user.role;
    if (!["ADMIN", "TEACHER", "COACH", "PARENT"].includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const where = {
      childId: childId || undefined,
    };

    if (role === "PARENT") {
      if (!childId) {
        return res.status(400).json({ error: "childId is required" });
      }

      const child = await prisma.child.findUnique({
        where: { id: childId },
        select: { id: true, parentId: true, centerId: true },
      });
      if (!child || child.parentId !== session.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (centerId && child.centerId !== centerId) {
        return res.status(200).json([]);
      }
      where.child = { id: child.id };
    } else if (role === "TEACHER") {
      if (childId) {
        const child = await prisma.child.findUnique({
          where: { id: childId },
          select: { id: true, centerId: true, classRoomId: true },
        });
        if (!child) return res.status(404).json({ error: "Child not found" });

        const hasClassAccess = await teacherCanAccessClass(
          session.user.id,
          child.classRoomId,
        );
        if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
        if (centerId && child.centerId !== centerId) {
          return res.status(200).json([]);
        }
      }

      where.child = {
        ...(centerId ? { centerId } : {}),
        ...teacherChildFilter(session.user.id),
      };
    } else if (role === "COACH") {
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      });
      const allowedCenterIds = memberships.map((membership) => membership.centerId);

      if (centerId && !allowedCenterIds.includes(centerId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scopedCenterIds = centerId ? [centerId] : allowedCenterIds;
      if (!scopedCenterIds.length) return res.status(200).json([]);

      where.child = { centerId: { in: scopedCenterIds } };
    } else if (centerId) {
      where.child = { centerId };
    }

    const progress = await prisma.progress.findMany({
      where,
      include: { child: true, lesson: { include: { category: true } }, lessonGoal: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(progress);
  }

  if (req.method === "POST") {
    // Create progress record (teachers/admins only)
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res
        .status(403)
        .json({
          error: "Only teachers and admins can create progress records",
        });
    }

    const { childId: cId, lessonId, status, goalIndex } = req.body;

    if (!cId || !lessonId) {
      return res.status(400).json({ error: "childId and lessonId required" });
    }

    if (session.user.role === "TEACHER") {
      const child = await prisma.child.findUnique({
        where: { id: cId },
        select: { id: true, classRoomId: true },
      });
      if (!child) return res.status(404).json({ error: "Child not found" });
      const hasClassAccess = await teacherCanAccessClass(session.user.id, child.classRoomId);
      if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
    }

    const normalizedGoalIndex = Number(goalIndex || 1);
    const lessonGoal = await prisma.lessonGoal.findUnique({
      where: { lessonId_goalIndex: { lessonId, goalIndex: normalizedGoalIndex } },
    });

    const progress = await prisma.progress.create({
      data: {
        childId: cId,
        lessonId,
        status: status || "NOT_STARTED",
        goalIndex: normalizedGoalIndex,
        lessonGoalId: lessonGoal?.id || null,
      },
      include: {
        child: true,
        lesson: { include: { category: true } },
        entries: true,
      },
    });

    return res.status(201).json(progress);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
