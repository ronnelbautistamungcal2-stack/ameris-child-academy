import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function getAllowedCenterIdsForUser(user) {
  if (user.role === "ADMIN") {
    const centers = await prisma.center.findMany({ select: { id: true } });
    return centers.map((c) => c.id);
  }
  if (user.role === "PARENT") {
    const children = await prisma.child.findMany({
      where: { parentId: user.id },
      select: { centerId: true },
    });
    return [...new Set(children.map((c) => c.centerId))];
  }
  const memberships = await prisma.centerUser.findMany({
    where: { userId: user.id },
    select: { centerId: true },
  });
  return memberships.map((m) => m.centerId);
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;

  if (req.method === "GET") {
    const { centerId, all } = req.query;
    const adminAll = user.role === "ADMIN" && (all === "1" || all === "true");

    const threads = await prisma.messageThread.findMany({
      where: {
        ...(adminAll
          ? { ...(centerId ? { centerId } : {}) }
          : { participants: { some: { userId: user.id } } }),
      },
      include: {
        participants: { include: { user: true } },
        center: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { sender: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return res.status(200).json(threads);
  }

  if (req.method === "POST") {
    const { participantIds, centerId, title, firstMessage } = req.body || {};
    const ids = Array.isArray(participantIds)
      ? participantIds.filter(Boolean)
      : [];

    const unique = [...new Set([user.id, ...ids])];
    if (unique.length < 2) {
      return res.status(400).json({ error: "At least one participant is required" });
    }

    if (centerId) {
      if (user.role !== "ADMIN") {
        const ok = await hasAccessToCenter(user.id, centerId);
        if (!ok) return res.status(403).json({ error: "Forbidden" });
      }
    } else if (user.role !== "ADMIN") {
      // Non-admins must be able to infer a shared center; require that sender has at least one center.
      const allowedCenterIds = await getAllowedCenterIdsForUser(user);
      if (!allowedCenterIds.length) {
        return res.status(403).json({ error: "No center access for messaging" });
      }
    }

    // Validate participants exist.
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, role: true },
    });
    if (users.length !== unique.length) {
      return res.status(400).json({ error: "Invalid participantIds" });
    }

    const thread = await prisma.messageThread.create({
      data: {
        centerId: centerId || null,
        title: title || null,
        participants: {
          create: unique.map((uid) => ({ userId: uid })),
        },
        messages: firstMessage
          ? {
              create: {
                senderId: user.id,
                body: String(firstMessage).slice(0, 5000),
              },
            }
          : undefined,
      },
      include: {
        participants: { include: { user: true } },
        center: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { sender: true },
        },
      },
    });

    return res.status(201).json(thread);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
