import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, category, classRoomId, date } = req.query;

    if (centerId && role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    let where = { active: true };
    if (centerId) where.centerId = centerId;
    if (category) where.category = category;
    if (classRoomId) where.classRoomId = classRoomId;

    if (!centerId && role !== "ADMIN") {
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      });
      where.centerId = { in: memberships.map((m) => m.centerId) };
    }

    // If date provided, include completions for that date
    const completionWhere = date ? { date: new Date(date) } : undefined;

    const lists = await prisma.dailyChecklist.findMany({
      where,
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            completions: completionWhere
              ? { where: completionWhere, include: { completedBy: { select: { id: true, name: true, email: true } } } }
              : false,
          },
        },
        classRoom: { select: { id: true, name: true } },
        center: { select: { id: true, name: true } },
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    return res.status(200).json(lists);
  }

  if (req.method === "POST") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create checklists" });
    }

    const { title, description, centerId, classRoomId, category, frequency, items } = req.body || {};

    if (!title || !centerId) {
      return res.status(400).json({ error: "title and centerId are required" });
    }

    const validCategories = ["OPENING", "CLOSING", "HEALTH_SAFETY", "CLEANING", "MEALS", "CLASSROOM", "OTHER"];
    const validFrequencies = ["DAILY", "WEEKLY", "MONTHLY"];

    const created = await prisma.dailyChecklist.create({
      data: {
        title,
        description: description || null,
        centerId,
        classRoomId: classRoomId || null,
        category: validCategories.includes(category) ? category : "OTHER",
        frequency: validFrequencies.includes(frequency) ? frequency : "DAILY",
        items: Array.isArray(items)
          ? {
              create: items
                .filter((it) => it && it.title)
                .map((it, i) => ({
                  title: it.title,
                  description: it.description || null,
                  policyLink: it.policyLink || null,
                  mediaLink: it.mediaLink || null,
                  sortOrder: i,
                })),
            }
          : undefined,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        classRoom: { select: { id: true, name: true } },
        center: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(created);
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update checklists" });
    }

    const { id, title, description, category, frequency, classRoomId, active, items } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (category !== undefined) data.category = category;
    if (frequency !== undefined) data.frequency = frequency;
    if (classRoomId !== undefined) data.classRoomId = classRoomId || null;
    if (active !== undefined) data.active = active;

    const updated = await prisma.dailyChecklist.update({
      where: { id },
      data,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        classRoom: { select: { id: true, name: true } },
        center: { select: { id: true, name: true } },
      },
    });

    // If items provided, sync them
    if (Array.isArray(items)) {
      // Delete removed items
      const existingIds = items.filter((it) => it.id).map((it) => it.id);
      await prisma.dailyChecklistItem.deleteMany({
        where: { checklistId: id, id: { notIn: existingIds } },
      });

      // Upsert items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.id) {
          await prisma.dailyChecklistItem.update({
            where: { id: it.id },
            data: { title: it.title, description: it.description || null, policyLink: it.policyLink || null, mediaLink: it.mediaLink || null, sortOrder: i },
          });
        } else if (it.title) {
          await prisma.dailyChecklistItem.create({
            data: { checklistId: id, title: it.title, description: it.description || null, policyLink: it.policyLink || null, mediaLink: it.mediaLink || null, sortOrder: i },
          });
        }
      }
    }

    // Re-fetch with updated items
    const result = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        classRoom: { select: { id: true, name: true } },
        center: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json(result);
  }

  if (req.method === "DELETE") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete checklists" });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    await prisma.dailyChecklist.delete({ where: { id } });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  res.status(405).end();
}
