import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;
  const { id } = req.query;

  const thread = await prisma.messageThread.findUnique({
    where: { id },
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

  if (req.method === "GET") {
    const full = await prisma.messageThread.findUnique({
      where: { id },
      include: {
        center: true,
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          include: {
            sender: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } },
          },
        },
      },
    });

    // Mark as read for the requesting user
    if (isParticipant) {
      await prisma.threadParticipant.updateMany({
        where: { threadId: id, userId: user.id },
        data: { lastReadAt: new Date() },
      });
    }

    return res.status(200).json(full);
  }

  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
