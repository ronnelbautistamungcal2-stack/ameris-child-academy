import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { childId } = req.query;
    if (!childId) return res.status(400).json({ error: "childId is required" });

    const child = await prisma.child.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ error: "Child not found" });

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const completed = await prisma.childTask.findMany({
      where: { childId },
      select: { taskId: true, completedAt: true },
    });
    return res.status(200).json(completed);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(role)) {
      return res.status(403).json({ error: "Only teachers/admins can update checklist completion" });
    }

    const { childId, taskId, completed } = req.body || {};
    if (!childId || !taskId) {
      return res.status(400).json({ error: "childId and taskId are required" });
    }

    const child = await prisma.child.findUnique({ where: { id: childId } });
    if (!child) return res.status(404).json({ error: "Child not found" });

    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, child.centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const isCompleted = completed !== undefined ? !!completed : true;
    const record = await prisma.childTask.upsert({
      where: { childId_taskId: { childId, taskId } },
      create: { childId, taskId, completedAt: isCompleted ? new Date() : null },
      update: { completedAt: isCompleted ? new Date() : null },
    });
    return res.status(200).json(record);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

