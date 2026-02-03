import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    include: { sender: true },
  });

  await prisma.messageThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  return res.status(201).json(message);
}

