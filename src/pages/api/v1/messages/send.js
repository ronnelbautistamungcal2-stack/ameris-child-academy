import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage } from "@/lib/socket";
import { assertSubscriptionFeature } from "@/lib/subscriptions";
import { notifyMessageRecipients } from "@/lib/messaging";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { threadId, body } = req.body || {};
  if (!threadId || !body) {
    return res.status(400).json({ error: "threadId and body are required" });
  }

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      participants: true,
      center: { include: { subscription: true } },
    },
  });
  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const isParticipant = thread.participants.some((p) => p.userId === user.id);
  if (!isParticipant && user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!isParticipant && user.role === "ADMIN") {
    // Ensure admins show up in thread participant lists once they interact.
    await prisma.threadParticipant
      .create({ data: { threadId, userId: user.id } })
      .catch(() => null);
  }

  if (thread.centerId && user.role !== "ADMIN") {
    const ok = await hasAccessToCenter(user.id, thread.centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }
  if (thread.center?.subscription) {
    try {
      assertSubscriptionFeature(thread.center.subscription, "messaging", {
        centerId: thread.centerId,
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

  const message = await prisma.message.create({
    data: {
      threadId,
      senderId: user.id,
      body: String(body).slice(0, 5000),
    },
    include: { sender: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } } },
  });

  // Update thread timestamp and sender's lastReadAt
  await Promise.all([
    prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }),
    prisma.threadParticipant.updateMany({
      where: { threadId, userId: user.id },
      data: { lastReadAt: new Date() },
    }),
  ]);

  // Emit real-time message to all participants
  const participantIds = thread.participants.map((p) => p.userId);
  emitNewMessage(participantIds, { ...message, threadId });

  const otherParticipantIds = participantIds.filter((id) => id !== user.id);
  if (otherParticipantIds.length > 0) {
    await notifyMessageRecipients({
      sender: user,
      recipientIds: otherParticipantIds,
      threadId,
      body,
    });
  }

  return res.status(201).json(message);
}
