import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";

const MESSAGE_ROLE_PATHS = {
  ADMIN: "/admin/messages",
  TEACHER: "/teacher/messages",
  OTHER_STAFF: "/staff/messages",
  PARENT: "/parent/messages",
  COACH: "/coach/messages",
};

// Message attachments must be files already stored by /api/v1/uploads, so a
// message can never smuggle in an arbitrary external link.
export function normalizeMessageAttachment(attachment) {
  const url = String(attachment?.url || "").trim();
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return {};
  const size = Number(attachment?.size);
  return {
    attachmentUrl: url,
    attachmentName: String(attachment?.name || "Attachment").slice(0, 200),
    attachmentSize: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
    attachmentType: attachment?.type ? String(attachment.type).slice(0, 120) : null,
  };
}

// A new message brings an archived or deleted conversation back into the
// recipients' inboxes, the way email does, so replies are never missed.
export async function resurfaceThreadForRecipients(threadId, recipientIds) {
  if (!recipientIds?.length) return;
  await prisma.threadParticipant.updateMany({
    where: {
      threadId,
      userId: { in: recipientIds },
      OR: [{ archivedAt: { not: null } }, { deletedAt: { not: null } }],
    },
    data: { archivedAt: null, deletedAt: null },
  });
}

async function createNotificationsWithFallback(data) {
  if (!data.length) return [];

  try {
    return await prisma.notification.createManyAndReturn({ data });
  } catch {
    return Promise.all(
      data.map((notification) =>
        prisma.notification.create({ data: notification }),
      ),
    );
  }
}

export async function notifyMessageRecipients({
  sender,
  recipientIds,
  threadId,
  body,
}) {
  const uniqueRecipientIds = [...new Set((recipientIds || []).filter(Boolean))];
  if (!uniqueRecipientIds.length) return [];

  const [preferences, recipients] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: { userId: { in: uniqueRecipientIds }, type: "MESSAGE" },
    }),
    prisma.user.findMany({
      where: { id: { in: uniqueRecipientIds } },
      select: { id: true, role: true },
    }),
  ]);

  const disabledIds = new Set(
    preferences.filter((preference) => !preference.enabled).map((preference) => preference.userId),
  );
  const recipientRoleById = Object.fromEntries(
    recipients.map((recipient) => [recipient.id, recipient.role]),
  );
  const senderName = sender?.name || sender?.email || "Someone";
  const preview = String(body || "").slice(0, 100);

  const notificationsToCreate = uniqueRecipientIds
    .filter((recipientId) => !disabledIds.has(recipientId))
    .map((recipientId) => {
      const basePath = MESSAGE_ROLE_PATHS[recipientRoleById[recipientId]] || "/parent/messages";
      return {
        recipientId,
        type: "MESSAGE",
        title: `New message from ${senderName}`,
        body: preview,
        link: `${basePath}?threadId=${threadId}`,
        metadata: { threadId, senderId: sender?.id || null },
      };
    });

  const createdNotifications = await createNotificationsWithFallback(
    notificationsToCreate,
  );

  createdNotifications.forEach((notification) => {
    emitNotification(notification.recipientId, notification);
  });

  return createdNotifications;
}
