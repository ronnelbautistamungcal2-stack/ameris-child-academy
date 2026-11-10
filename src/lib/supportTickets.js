// Customer Support tickets between subscribers and Ameris Solutions, with
// support access to a subscriber's center (client 2026-11-07, step F):
// Ameris clicks Request Center Access, the subscriber grants it, and access
// lasts until someone clicks End Access. It doesn't end when the ticket closes.
import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"];
export const TICKET_STATUS_LABELS = { OPEN: "Open", IN_PROGRESS: "In Progress", CLOSED: "Closed" };
export const ACCESS_STATUS_LABELS = {
  REQUESTED: "Requested",
  GRANTED: "Granted",
  DECLINED: "Declined",
  ENDED: "Ended",
};
// A grant that is still waiting or still in force.
export const LIVE_ACCESS = ["REQUESTED", "GRANTED"];

export function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/** Next free "T-####" ticket number, starting at T-1001. */
export async function nextTicketNumber(db = prisma) {
  const rows = await db.supportTicket.findMany({ select: { number: true } });
  const max = rows.reduce((top, row) => {
    const n = Number(String(row.number).replace(/^T-/, ""));
    return Number.isFinite(n) && n > top ? n : top;
  }, 1000);
  return `T-${max + 1}`;
}

const person = { select: { id: true, name: true, email: true } };

export const ticketDetailInclude = {
  account: { select: { id: true, accountNumber: true, name: true } },
  center: { select: { id: true, name: true } },
  openedBy: person,
  messages: { include: { author: person }, orderBy: { createdAt: "asc" } },
  accessGrants: {
    include: { center: { select: { id: true, name: true } }, requestedBy: person, answeredBy: person, endedBy: person },
    orderBy: { createdAt: "desc" },
  },
};

export const ticketListInclude = {
  account: { select: { id: true, accountNumber: true, name: true } },
  center: { select: { id: true, name: true } },
  openedBy: person,
  messages: { select: { body: true, createdAt: true, fromAmeris: true, isEvent: true }, orderBy: { createdAt: "desc" }, take: 1 },
  accessGrants: { where: { status: { in: LIVE_ACCESS } }, select: { id: true, status: true } },
};

/** List row: the ticket with its latest message and live access. */
export function listRow(ticket) {
  const { messages, accessGrants, ...rest } = ticket;
  return {
    ...rest,
    lastMessage: messages[0] || null,
    accessStatus: accessGrants.some((g) => g.status === "GRANTED")
      ? "GRANTED"
      : accessGrants.some((g) => g.status === "REQUESTED")
        ? "REQUESTED"
        : null,
  };
}

/** Ids of the Ameris Solutions global admins (they all work the support queue). */
export async function globalAdminIds(db = prisma) {
  const users = await db.user.findMany({
    where: { disabled: false, OR: [{ role: "GLOBAL_ADMIN" }, { roles: { has: "GLOBAL_ADMIN" } }] },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Ids of the subscriber's admins. */
export async function accountAdminIds(accountId, db = prisma) {
  const users = await db.user.findMany({
    where: { disabled: false, subscriberAccountId: accountId, OR: [{ role: "ADMIN" }, { roles: { has: "ADMIN" } }] },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** In-app notice to each person except the one who acted. Never fails the request. */
export async function notify(userIds, actorId, { title, body, link }) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== actorId);
  for (const recipientId of ids) {
    try {
      const notification = await prisma.notification.create({
        data: { recipientId, type: "SYSTEM", title, body: body.slice(0, 500), link },
      });
      emitNotification(recipientId, notification);
    } catch (err) {
      console.error("support notification failed", err);
    }
  }
}

/** Tells the other side about something on the ticket. */
export async function notifyOtherSide(ticket, actor, { fromAmeris, title, body }) {
  if (fromAmeris) {
    await notify(await accountAdminIds(ticket.accountId), actor.id, {
      title,
      body,
      link: `/admin/support?ticket=${ticket.id}`,
    });
  } else {
    await notify(await globalAdminIds(), actor.id, {
      title,
      body,
      link: `/global/support?ticket=${ticket.id}`,
    });
  }
}

/** Adds a line to the ticket's conversation and touches the ticket. */
export async function addTicketMessage(db, ticketId, { authorId, fromAmeris, isEvent = false, body }) {
  const message = await db.supportTicketMessage.create({
    data: { ticketId, authorId, fromAmeris, isEvent, body },
  });
  await db.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
  return message;
}

/** Centers the Ameris global admins may currently reach through a granted support request. */
export async function supportGrantedCenterIds(db = prisma) {
  const grants = await db.supportAccessGrant.findMany({ where: { status: "GRANTED" }, select: { centerId: true } });
  return [...new Set(grants.map((g) => g.centerId))];
}

/**
 * Ends, grants or declines a support access grant.
 * `side` is "AMERIS" or "SUBSCRIBER". Returns { grant } or { status, error }.
 */
export async function answerAccess(grantId, action, actor, side) {
  const grant = await prisma.supportAccessGrant.findUnique({
    where: { id: grantId },
    include: { ticket: true, center: { select: { id: true, name: true, subscriberAccountId: true } } },
  });
  if (!grant) return { status: 404, error: "Access request not found" };
  if (side === "SUBSCRIBER" && grant.ticket.accountId !== actor.subscriberAccountId) {
    return { status: 404, error: "Access request not found" };
  }
  const now = new Date();
  let data;
  let line;
  if (action === "GRANT" || action === "DECLINE") {
    if (side !== "SUBSCRIBER") return { status: 403, error: "Only the subscriber can grant or decline access" };
    if (grant.status !== "REQUESTED") return { status: 409, error: "This request has already been answered" };
    data = { status: action === "GRANT" ? "GRANTED" : "DECLINED", answeredById: actor.id, answeredAt: now };
    line = action === "GRANT" ? `Center access to ${grant.center.name} granted.` : `Center access to ${grant.center.name} declined.`;
  } else if (action === "END") {
    if (!LIVE_ACCESS.includes(grant.status)) return { status: 409, error: "This access has already ended" };
    data = { status: "ENDED", endedById: actor.id, endedAt: now };
    line =
      grant.status === "REQUESTED"
        ? `Center access request for ${grant.center.name} withdrawn.`
        : `Center access to ${grant.center.name} ended.`;
  } else {
    return { status: 400, error: "Action must be GRANT, DECLINE or END" };
  }
  const fromAmeris = side === "AMERIS";
  const updated = await prisma.$transaction(async (tx) => {
    const g = await tx.supportAccessGrant.update({ where: { id: grant.id }, data });
    await addTicketMessage(tx, grant.ticketId, { authorId: actor.id, fromAmeris, isEvent: true, body: line });
    return g;
  });
  await notifyOtherSide(grant.ticket, actor, {
    fromAmeris,
    title: `Ticket ${grant.ticket.number}: ${line.replace(/\.$/, "")}`,
    body: grant.ticket.subject,
  });
  return { grant: updated };
}
