import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;

  const checklist = await prisma.taskChecklist.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: [{ taskTime: "asc" }, { createdAt: "asc" }] },
      center: true,
    },
  });
  if (!checklist) return res.status(404).json({ error: "Checklist not found" });

  if (role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, checklist.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    return res.status(200).json(checklist);
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update checklists" });
    }
    const { title, description, tasks } = req.body || {};

    await prisma.$transaction(async (tx) => {
      await tx.taskChecklist.update({
        where: { id },
        data: {
          title: title ?? undefined,
          description: description === undefined ? undefined : description || null,
        },
      });

      if (Array.isArray(tasks)) {
        const existing = await tx.task.findMany({
          where: { checklistId: id },
          select: { id: true },
        });
        const existingIds = new Set(existing.map((task) => task.id));
        const validTasks = tasks.filter((task) => task && String(task.title || "").trim());
        const keepIds = new Set(validTasks.filter((task) => task.id && existingIds.has(task.id)).map((task) => task.id));
        const deleteIds = existing.filter((task) => !keepIds.has(task.id)).map((task) => task.id);

        if (deleteIds.length) {
          await tx.childTask.deleteMany({ where: { taskId: { in: deleteIds } } });
          await tx.task.deleteMany({ where: { id: { in: deleteIds } } });
        }

        for (const task of validTasks) {
          const data = {
            title: String(task.title).trim(),
            policyLink: task.policyLink || null,
            mediaLink: task.mediaLink || null,
            taskTime: task.taskTime || null,
          };

          if (task.id && existingIds.has(task.id)) {
            await tx.task.update({ where: { id: task.id }, data });
          } else {
            await tx.task.create({ data: { ...data, checklistId: id } });
          }
        }
      }
    });

    const updated = await prisma.taskChecklist.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: [{ taskTime: "asc" }, { createdAt: "asc" }] },
        center: true,
      },
    });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete checklists" });
    }

    // TaskChecklist -> Task -> ChildTask uses RESTRICT FKs in the DB migrations,
    // so we must delete dependent rows explicitly.
    await prisma.$transaction(async (tx) => {
      await tx.childTask.deleteMany({
        where: { task: { checklistId: id } },
      });
      await tx.task.deleteMany({ where: { checklistId: id } });
      await tx.taskChecklist.delete({ where: { id } });
    });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
