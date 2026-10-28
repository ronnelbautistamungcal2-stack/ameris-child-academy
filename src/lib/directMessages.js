// Sends a one-to-one message thread from one user to each recipient (server
// only), e.g. a staff member asking their coach for a training observation.

import prisma from "@/lib/prisma";
import { notifyMessageRecipients } from "@/lib/messaging";
import { emitNewMessage } from "@/lib/socket";

export async function sendDirectMessage({ sender, recipientIds, centerId = null, title, body }) {
  const threads = [];
  for (const recipientId of [...new Set(recipientIds)].filter((id) => id && id !== sender.id)) {
    const thread = await prisma.messageThread.create({
      data: {
        centerId,
        title: title || null,
        type: "MESSAGE",
        status: "OPEN",
        createdById: sender.id,
        participants: {
          create: [{ userId: sender.id, lastReadAt: new Date() }, { userId: recipientId }],
        },
        messages: { create: { senderId: sender.id, body: String(body || "").slice(0, 5000) } },
      },
      include: { messages: true },
    });
    const message = thread.messages[0];
    emitNewMessage([sender.id, recipientId], { ...message, threadId: thread.id });
    await notifyMessageRecipients({ sender, recipientIds: [recipientId], threadId: thread.id, body: message.body });
    threads.push(thread.id);
  }
  return threads;
}
