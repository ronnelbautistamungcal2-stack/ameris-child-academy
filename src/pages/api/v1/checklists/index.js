import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId } = req.query;

  if (req.method === "GET") {
    if (centerId && role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    let where = {};
    if (centerId) {
      where = { centerId };
    } else if (role !== "ADMIN") {
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      });
      const centerIds = memberships.map((m) => m.centerId);
      where = { centerId: { in: centerIds.length ? centerIds : ["__none__"] } };
    }

    const lists = await prisma.taskChecklist.findMany({
      where,
      include: {
        tasks: { orderBy: [{ taskTime: "asc" }, { createdAt: "asc" }] },
        center: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(lists);
  }

  if (req.method === "POST") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create checklists" });
    }

    const { title, description, tasks, centerId: cId } = req.body || {};
    if (!title || !cId) {
      return res.status(400).json({ error: "title and centerId are required" });
    }

    const created = await prisma.taskChecklist.create({
      data: {
        title,
        description: description || null,
        centerId: cId,
        tasks: Array.isArray(tasks)
          ? {
              create: tasks
                .filter((t) => t && t.title)
                .map((t) => ({
                  title: t.title,
                  policyLink: t.policyLink || null,
                  mediaLink: t.mediaLink || null,
                  taskTime: t.taskTime || null,
                })),
            }
          : undefined,
      },
      include: {
        tasks: { orderBy: [{ taskTime: "asc" }, { createdAt: "asc" }] },
        center: true,
      },
    });

    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
