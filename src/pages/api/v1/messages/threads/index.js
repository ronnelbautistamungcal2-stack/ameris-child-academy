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
  resolveMessageRecipientRole,
  supportsDueDate,
  supportsPriority,
} from "@/lib/messageWorkflows";

const THREAD_INCLUDE = {
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
};

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
        ...THREAD_INCLUDE,
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
      participants,
      participantIds,
      centerId,
      title,
      firstMessage,
      audienceKeys,
      threadType,
      priority,
      dueDate,
    } = req.body || {};

    // Accept either `participants` (with an optional per-person role) or the
    // legacy flat `participantIds` array.
    const manualEntries = Array.isArray(participants)
      ? participants
      : Array.isArray(participantIds)
        ? participantIds.map((id) => ({ id }))
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

    // Every selected recipient gets their own private thread with the sender
    // — recipients never see each other's replies. Explicit picks win over an
    // inferred audience role for the same person.
    const requestedRoleById = new Map();
    for (const entry of manualEntries) {
      const id = entry?.id;
      if (!id || id === user.id) continue;
      if (!requestedRoleById.has(id)) requestedRoleById.set(id, entry.role || null);
    }
    for (const audienceUser of audienceUsers) {
      if (!audienceUser?.id || audienceUser.id === user.id) continue;
      if (!requestedRoleById.has(audienceUser.id)) {
        requestedRoleById.set(audienceUser.id, audienceUser.asRole || null);
      }
    }

    if (requestedRoleById.size === 0) {
      return res.status(400).json({ error: "At least one recipient is required" });
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

    // Validate recipients exist.
    const recipientIds = [...requestedRoleById.keys()];
    const recipientUsers = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, role: true, roles: true },
    });
    if (recipientUsers.length !== recipientIds.length) {
      return res.status(400).json({ error: "Invalid recipients" });
    }

    const resolvedRecipients = recipientUsers.map((recipientUser) => ({
      id: recipientUser.id,
      asRole: resolveMessageRecipientRole({
        user: recipientUser,
        requestedRole: requestedRoleById.get(recipientUser.id),
        threadType: normalizedThreadType,
      }),
    }));

    if (
      isAccommodationThread(normalizedThreadType) &&
      resolvedRecipients.some((recipient) => !canReceiveAccommodation(recipient.asRole))
    ) {
      return res.status(400).json({
        error: "Accommodations can only be sent to teachers or staff.",
      });
    }

    const createdThreads = await Promise.all(
      resolvedRecipients.map(async (recipient) => {
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
              create: [
                { userId: user.id, lastReadAt: new Date() },
                { userId: recipient.id, asRole: recipient.asRole || undefined },
              ],
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
          include: THREAD_INCLUDE,
        });

        const firstThreadMessage = thread.messages?.[0] || null;
        if (firstThreadMessage) {
          emitNewMessage([user.id, recipient.id], { ...firstThreadMessage, threadId: thread.id });

          await notifyMessageRecipients({
            sender: user,
            recipientIds: [recipient.id],
            threadId: thread.id,
            body: firstThreadMessage.body,
          });
        }

        return thread;
      }),
    );

    return res.status(201).json({ threads: createdThreads });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
