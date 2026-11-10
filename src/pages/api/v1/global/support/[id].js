import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import {
  addTicketMessage,
  LIVE_ACCESS,
  notifyOtherSide,
  text,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  ticketDetailInclude,
} from "@/lib/supportTickets";

async function detail(id) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: ticketDetailInclude });
  if (!ticket) return null;
  // The subscriber's centers, for Request Center Access.
  const centers = await prisma.center.findMany({
    where: { subscriberAccountId: ticket.accountId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { ...ticket, accountCenters: centers };
}

// One ticket for Ameris: read it, reply, change its status, request center access.
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return;
  const user = session.user;
  const id = String(req.query.id || "");
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  if (req.method === "GET") return res.status(200).json(await detail(id));

  if (req.method === "PATCH") {
    const status = String(req.body?.status || "").toUpperCase();
    if (!TICKET_STATUSES.includes(status)) return res.status(400).json({ error: `Status must be one of ${TICKET_STATUSES.join(", ")}` });
    if (status !== ticket.status) {
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({ where: { id }, data: { status, closedAt: status === "CLOSED" ? new Date() : null } });
        await addTicketMessage(tx, id, { authorId: user.id, fromAmeris: true, isEvent: true, body: `Status changed to ${TICKET_STATUS_LABELS[status]}.` });
      });
      await notifyOtherSide(ticket, user, { fromAmeris: true, title: `Ticket ${ticket.number} is ${TICKET_STATUS_LABELS[status]}`, body: ticket.subject });
    }
    return res.status(200).json(await detail(id));
  }

  if (req.method === "POST") {
    const reply = text(req.body?.reply, 5000);
    const access = req.body?.requestAccess;
    if (reply) {
      await prisma.$transaction(async (tx) => {
        await addTicketMessage(tx, id, { authorId: user.id, fromAmeris: true, body: reply });
        if (ticket.status === "OPEN") await tx.supportTicket.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      });
      await notifyOtherSide(ticket, user, { fromAmeris: true, title: `Ameris Solutions replied on ticket ${ticket.number}`, body: reply });
      return res.status(200).json(await detail(id));
    }
    if (access) {
      const centerId = String(access.centerId || ticket.centerId || "");
      const center = centerId
        ? await prisma.center.findFirst({ where: { id: centerId, subscriberAccountId: ticket.accountId }, select: { id: true, name: true } })
        : null;
      if (!center) return res.status(400).json({ error: "Pick one of the subscriber's centers" });
      const live = await prisma.supportAccessGrant.findFirst({ where: { ticketId: id, centerId: center.id, status: { in: LIVE_ACCESS } } });
      if (live) return res.status(409).json({ error: `Access to ${center.name} is already ${live.status === "GRANTED" ? "granted" : "requested"}` });
      const reason = text(access.reason, 500) || null;
      await prisma.$transaction(async (tx) => {
        await tx.supportAccessGrant.create({ data: { ticketId: id, centerId: center.id, reason, requestedById: user.id } });
        await addTicketMessage(tx, id, {
          authorId: user.id,
          fromAmeris: true,
          isEvent: true,
          body: `Ameris Solutions requested access to ${center.name}.${reason ? ` Reason: ${reason}` : ""}`,
        });
      });
      await notifyOtherSide(ticket, user, {
        fromAmeris: true,
        title: `Ameris Solutions asks for access to ${center.name}`,
        body: `Ticket ${ticket.number}: ${ticket.subject}. Open Customer Support to grant or decline.`,
      });
      return res.status(201).json(await detail(id));
    }
    return res.status(400).json({ error: "Send a reply or a requestAccess" });
  }

  res.setHeader("Allow", "GET, PATCH, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
