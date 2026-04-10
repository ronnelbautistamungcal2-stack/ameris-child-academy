import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";

const MESSAGE_ROLE_PATHS = {
  ADMIN: "/admin/messages",
  TEACHER: "/teacher/messages",
  PARENT: "/parent/messages",
  COACH: "/coach/messages",
};

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
