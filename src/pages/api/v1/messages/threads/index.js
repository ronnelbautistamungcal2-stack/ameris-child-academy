import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emitNewMessage } from "@/lib/socket";
import { notifyMessageRecipients } from "@/lib/messaging";
import {
  getAllowedMessagingCenterIds,
  resolveMessageAudienceUsers,
} from "@/lib/messageAudiences";
import {
  canReceiveAccommodation,
  getAvailableThreadTypesForRole,
  isAccommodationThread,
  normalizePriorityLevel,
  normalizeThreadType,
  supportsDueDate,
  supportsPriority,
} from "@/lib/messageWorkflows";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = session.user;

  if (req.method === "GET") {
    const { centerId, all, type, status } = req.query;
    const adminAll = user.role === "ADMIN" && (all === "1" || all === "true");
    const normalizedType = String(type || "").trim().toUpperCase();
    const normalizedStatus = String(status || "").trim().toUpperCase();

    const threads = await prisma.messageThread.findMany({
      where: {
        ...(adminAll
          ? { ...(centerId ? { centerId } : {}) }
          : { participants: { some: { userId: user.id } } }),
        ...(normalizedType ? { type: normalizedType } : {}),
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      include: {
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
        center: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: adminAll ? 200 : 75,
    });

    const enriched = await Promise.all(
      threads.map(async (thread) => {
        const myParticipant = thread.participants.find((participant) => participant.userId === user.id);
        if (!myParticipant) {
          return { ...thread, unreadCount: 0 };
        }

        const unreadCount = await prisma.message.count({
          where: {
            threadId: thread.id,
            senderId: { not: user.id },
            ...(myParticipant.lastReadAt
              ? { createdAt: { gt: myParticipant.lastReadAt } }
              : {}),
          },
        });

        return { ...thread, unreadCount };
      }),
    );

    return res.status(200).json(enriched);
  }

  if (req.method === "POST") {
    const {
      participantIds,
      centerId,
      title,
      firstMessage,
      audienceKeys,
      threadType,
      priority,
      dueDate,
    } = req.body || {};
    const ids = Array.isArray(participantIds)
      ? participantIds.filter(Boolean)
      : [];
    const normalizedAudienceKeys = Array.isArray(audienceKeys)
      ? [...new Set(audienceKeys.map((key) => String(key || "").trim()).filter(Boolean))]
      : [];
    const normalizedThreadType = normalizeThreadType(threadType);

    let audienceUsers = [];
    try {
      audienceUsers = (
        await Promise.all(
          normalizedAudienceKeys.map((audienceKey) =>
            resolveMessageAudienceUsers({
              prismaClient: prisma,
              user,
              audienceKey,
              centerId,
              threadType: normalizedThreadType,
            }),
          ),
        )
      ).flat();
    } catch (error) {
      return res.status(error.status || 400).json({
        error: error.message || "Failed to resolve selected audience",
      });
    }

    const allowedTypes = getAvailableThreadTypesForRole(user.role).map((item) => item.value);
    if (!allowedTypes.includes(normalizedThreadType)) {
      return res.status(403).json({ error: "This account cannot send that message type" });
    }

    const normalizedPriority = supportsPriority(normalizedThreadType)
      ? normalizePriorityLevel(priority)
      : null;
    const normalizedDueDate =
      supportsDueDate(normalizedThreadType) && dueDate
        ? new Date(dueDate)
        : null;

    if (supportsDueDate(normalizedThreadType) && dueDate && Number.isNaN(normalizedDueDate?.getTime?.())) {
      return res.status(400).json({ error: "Invalid dueDate" });
    }

    const unique = [...new Set([user.id, ...ids, ...audienceUsers.map((recipient) => recipient.id)])];
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
      const allowedCenterIds = await getAllowedMessagingCenterIds(prisma, user);
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
    if (
      isAccommodationThread(normalizedThreadType) &&
      users.some(
        (participant) =>
          participant.id !== user.id &&
          !canReceiveAccommodation(participant.role),
      )
    ) {
      return res.status(400).json({
        error: "Accommodations can only be sent to teachers or staff.",
      });
    }

    const thread = await prisma.messageThread.create({
      data: {
        centerId: centerId || null,
        title: title || null,
        type: normalizedThreadType,
        status: "OPEN",
        priority: normalizedPriority,
        dueDate: normalizedDueDate,
        createdById: user.id,
        participants: {
          create: unique.map((uid) => ({
            userId: uid,
            lastReadAt: uid === user.id ? new Date() : null,
          })),
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
        center: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: { select: { id: true, name: true, email: true, role: true, pictureUrl: true } },
          },
        },
      },
    });

    const firstThreadMessage = thread.messages?.[0] || null;
    if (firstThreadMessage) {
      emitNewMessage(unique, { ...firstThreadMessage, threadId: thread.id });

      await notifyMessageRecipients({
        sender: user,
        recipientIds: unique.filter((participantId) => participantId !== user.id),
        threadId: thread.id,
        body: firstThreadMessage.body,
      });
    }

    return res.status(201).json(thread);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
