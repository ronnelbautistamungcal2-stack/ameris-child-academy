import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherCanAccessClass } from "@/lib/teacherScope";
import { assertSubscriptionFeature } from "@/lib/subscriptions";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { childId, format = "json" } = req.query;
  if (!childId) return res.status(400).json({ error: "childId is required" });

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: {
      center: { include: { subscription: true } },
      classRoom: { select: { name: true } },
    },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });
  if (child.center?.subscription) {
    try {
      assertSubscriptionFeature(child.center.subscription, "exports", {
        centerId: child.centerId,
      });
    } catch (error) {
      return res.status(error.status || 402).json({
        ok: false,
        message: error.message,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }
  }

  if (session.user.role === "TEACHER") {
    const hasClassAccess = await teacherCanAccessClass(session.user.id, child.classRoomId);
    if (!hasClassAccess) return res.status(403).json({ error: "Forbidden" });
  }

  const progress = await prisma.progress.findMany({
    where: { childId },
    include: {
      lesson: { include: { category: true, goals: { orderBy: { goalIndex: "asc" } } } },
      lessonGoal: true,
      entries: {
        orderBy: { occurredAt: "desc" },
        include: { recordedBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const childName = `${child.firstName} ${child.lastName || ""}`.trim();

  if (format === "csv") {
    const rows = [["Lesson", "Category", "Goal Index", "Goal Title", "Status", "Achieved At", "Last Note", "Last Recorded By", "Created At"]];

    for (const pr of progress) {
      const lastEntry = pr.entries[0] || null;
      rows.push([
        pr.lesson?.title || "",
        pr.lesson?.category?.name || "",
        String(pr.goalIndex),
        pr.lessonGoal?.title || "",
        pr.status,
        pr.achievedAt ? new Date(pr.achievedAt).toISOString() : "",
        lastEntry?.notes || "",
        lastEntry?.recordedBy?.name || "",
        new Date(pr.createdAt).toISOString(),
      ]);
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="progress-${childName.replace(/\s+/g, "-")}.csv"`);
    return res.status(200).send(csv);
  }

  // JSON export
  const data = {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    child: {
      firstName: child.firstName,
      lastName: child.lastName,
      birthDate: child.birthDate,
    },
    center: { name: child.center?.name || "" },
    classroom: { name: child.classRoom?.name || "" },
    progressRecords: progress.map((pr) => ({
      lesson: {
        title: pr.lesson?.title,
        description: pr.lesson?.description,
        category: pr.lesson?.category?.name || null,
      },
      goalIndex: pr.goalIndex,
      goalTitle: pr.lessonGoal?.title || null,
      goalDescription: pr.lessonGoal?.description || null,
      status: pr.status,
      achievedAt: pr.achievedAt,
      createdAt: pr.createdAt,
      entries: pr.entries.map((e) => ({
        status: e.status,
        notes: e.notes,
        media: e.media,
        occurredAt: e.occurredAt,
        recordedBy: e.recordedBy?.name || null,
      })),
    })),
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="progress-${childName.replace(/\s+/g, "-")}.json"`);
  return res.status(200).json(data);
}
