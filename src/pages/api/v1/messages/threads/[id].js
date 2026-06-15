import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage } from "@/lib/socket";
import { notifyMessageRecipients } from "@/lib/messaging";
import {
  canCompleteWorkflow,
  canMarkReadyForReview,
  canReopenWorkflow,
  threadTypeLabel,
} from "@/lib/messageWorkflows";

async function loadFullThread(id) {
  return prisma.messageThread.findUnique({
    where: { id },
    include: {
      center: true,
      createdBy: {
        select: { id: true, name: true, email: true, role: true, pictureUrl: true },
      },
      completedBy: {
        select: { id: true, name: true, email: true, role: true, pictureUrl: true },
      },
      reviewRequestedBy: {
        select: { id: true, name: true, email: true, role: true, pictureUrl: true },
      },
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
}

function actorName(user) {
  return user?.name || user?.email || "Someone";
}

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
    const full = await loadFullThread(id);

    // Mark as read for the requesting user
    if (isParticipant) {
      await prisma.threadParticipant.updateMany({
        where: { threadId: id, userId: user.id },
        data: { lastReadAt: new Date() },
      });
    }

    return res.status(200).json(full);
  }

  if (req.method === "PUT") {
    const action = String(req.body?.action || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim();
    const isAdmin = user.role === "ADMIN";

    if (!isParticipant && isAdmin) {
      await prisma.threadParticipant
        .create({ data: { threadId: id, userId: user.id, lastReadAt: new Date() } })
        .catch(() => null);
    }

    const current = await loadFullThread(id);
    if (!current) return res.status(404).json({ error: "Thread not found" });

    let threadData = null;
    let messageBody = "";

    if (action === "READY_FOR_REVIEW") {
      if (!canMarkReadyForReview(current, user.id, isAdmin)) {
        return res.status(403).json({ error: "You cannot mark this item ready for review" });
      }
      threadData = {
        status: "READY_FOR_REVIEW",
        reviewRequestedAt: new Date(),
        reviewRequestedById: user.id,
        completedAt: null,
        completedById: null,
      };
      messageBody = note
        ? `${actorName(user)} marked this ${threadTypeLabel(current.type).toLowerCase()} ready for review: ${note}`
        : `${actorName(user)} marked this ${threadTypeLabel(current.type).toLowerCase()} ready for review.`;
    } else if (action === "COMPLETE") {
      if (!canCompleteWorkflow(current, user.id, isAdmin)) {
        return res.status(403).json({ error: "You cannot complete this item" });
      }
      threadData = {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: user.id,
      };
      messageBody = note
        ? `${actorName(user)} marked this ${threadTypeLabel(current.type).toLowerCase()} completed: ${note}`
        : `${actorName(user)} marked this ${threadTypeLabel(current.type).toLowerCase()} completed.`;
    } else if (action === "REOPEN") {
      if (!canReopenWorkflow(current, user.id, isAdmin)) {
        return res.status(403).json({ error: "You cannot reopen this item" });
      }
      if (!note) {
        return res.status(400).json({ error: "A note is required when sending an item back" });
      }
      threadData = {
        status: "OPEN",
        completedAt: null,
        completedById: null,
        reviewRequestedAt: null,
        reviewRequestedById: null,
      };
      messageBody = `${actorName(user)} sent this ${threadTypeLabel(current.type).toLowerCase()} back with a note: ${note}`;
    } else {
      return res.status(400).json({ error: "Unsupported workflow action" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const workflowMessage = await tx.message.create({
        data: {
          threadId: id,
          senderId: user.id,
          body: messageBody,
        },
        include: {
          sender: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } },
        },
      });

      await tx.messageThread.update({
        where: { id },
        data: {
          ...threadData,
          updatedAt: new Date(),
        },
      });

      await tx.threadParticipant.updateMany({
        where: { threadId: id, userId: user.id },
        data: { lastReadAt: new Date() },
      });

      return workflowMessage;
    });

    const participantIds = current.participants.map((participant) => participant.userId);
    emitNewMessage(participantIds, { ...updated, threadId: id });

    const otherParticipantIds = participantIds.filter((participantId) => participantId !== user.id);
    if (otherParticipantIds.length > 0) {
      await notifyMessageRecipients({
        sender: user,
        recipientIds: otherParticipantIds,
        threadId: id,
        body: messageBody,
      });
    }

    const full = await loadFullThread(id);
    return res.status(200).json(full);
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  res.status(405).end();
}
