import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, unauthorized, badRequest } from "@/lib/api-error";
import { ensureObject, optionalBoolean, optionalNumber, optionalString } from "@/lib/validation";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const userId = session.user.id;

  if (req.method === "GET") {
    const limit = Math.min(optionalNumber(req.query, "limit", { integer: true, min: 1, max: 100 }) || 50, 100);
    const cursor = optionalString(req.query, "cursor");

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

  const body = ensureObject(req.body || {});
  const readAll = optionalBoolean(body, "readAll");
  if (!readAll) {
    throw badRequest("readAll must be true");
  }

  await prisma.notification.updateMany({
    where: { recipientId: userId, read: false },
    data: { read: true },
  });
  return res.status(200).json({ success: true });
}, { methods: ["GET", "PATCH"], logLabel: "notifications/index error:" });
