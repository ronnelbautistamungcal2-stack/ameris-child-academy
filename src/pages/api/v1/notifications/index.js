import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  if (req.method === "GET") {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const cursor = req.query.cursor || undefined;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      prisma.notification.count({
        where: { recipientId: userId, read: false },
      }),
    ]);

    return res.status(200).json({ notifications, unreadCount });
  }

  if (req.method === "PATCH") {
    const { readAll } = req.body || {};
    if (readAll) {
      await prisma.notification.updateMany({
        where: { recipientId: userId, read: false },
        data: { read: true },
      });
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "Invalid patch body" });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  res.status(405).end();
}
