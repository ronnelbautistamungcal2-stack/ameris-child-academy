import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage, emitNotification } from "@/lib/socket";

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
    include: { participants: true },
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

  // Create notifications for non-sender participants (respecting preferences)
  const otherParticipantIds = participantIds.filter((id) => id !== user.id);
  if (otherParticipantIds.length > 0) {
    const [prefs, recipientUsers] = await Promise.all([
      prisma.notificationPreference.findMany({
        where: { userId: { in: otherParticipantIds }, type: "MESSAGE" },
      }),
      prisma.user.findMany({
        where: { id: { in: otherParticipantIds } },
        select: { id: true, role: true },
      }),
    ]);
    const disabledSet = new Set(prefs.filter((p) => !p.enabled).map((p) => p.userId));
    const roleMap = Object.fromEntries(recipientUsers.map((u) => [u.id, u.role]));

    const senderName = user.name || user.email;
    const preview = String(body).slice(0, 100);

    const rolePaths = {
      ADMIN: "/admin/messages",
      TEACHER: "/teacher/messages",
      PARENT: "/parent/messages",
      COACH: "/coach/messages",
    };

    const notificationsToCreate = otherParticipantIds
      .filter((id) => !disabledSet.has(id))
      .map((recipientId) => {
        const basePath = rolePaths[roleMap[recipientId]] || "/parent/messages";
        return {
          recipientId,
          type: "MESSAGE",
          title: `New message from ${senderName}`,
          body: preview,
          link: `${basePath}?threadId=${threadId}`,
          metadata: { threadId, senderId: user.id },
        };
      });

    if (notificationsToCreate.length > 0) {
      const created = await prisma.notification.createManyAndReturn({
        data: notificationsToCreate,
      }).catch(() => {
        // Fallback: createMany without return for older Prisma
        return prisma.notification.createMany({ data: notificationsToCreate }).then(() => notificationsToCreate);
      });

      // Emit real-time notification to each recipient
      for (const n of Array.isArray(created) ? created : notificationsToCreate) {
        emitNotification(n.recipientId, n);
      }
    }
  }

  return res.status(201).json(message);
}
