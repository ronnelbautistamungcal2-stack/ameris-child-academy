import prisma from "@/lib/prisma";
import { requireSubscriberAdmin } from "@/lib/supportAuth";
import {
  addTicketMessage,
  listRow,
  nextTicketNumber,
  notifyOtherSide,
  text,
  TICKET_STATUSES,
  ticketListInclude,
} from "@/lib/supportTickets";

// The subscriber's Customer Support tickets (Admin > Customer Support).
export default async function handler(req, res) {
  const user = await requireSubscriberAdmin(req, res);
  if (!user) return;
  const accountId = user.subscriberAccountId;

  if (req.method === "GET") {
    const status = String(req.query.status || "").toUpperCase();
    const where = { accountId, ...(TICKET_STATUSES.includes(status) ? { status } : {}) };
    const tickets = await prisma.supportTicket.findMany({ where, include: ticketListInclude, orderBy: { updatedAt: "desc" } });
    return res.status(200).json({ tickets: tickets.map(listRow) });
  }

  if (req.method === "POST") {
    const subject = text(req.body?.subject, 200);
    const body = text(req.body?.body, 5000);
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    if (!body) return res.status(400).json({ error: "Describe the problem" });
    let centerId = req.body?.centerId ? String(req.body.centerId) : null;
    if (centerId) {
      const center = await prisma.center.findFirst({ where: { id: centerId, subscriberAccountId: accountId }, select: { id: true } });
      if (!center) return res.status(400).json({ error: "That center isn't on your account" });
    }
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: { number: await nextTicketNumber(tx), accountId, centerId, subject, openedById: user.id },
      });
      await addTicketMessage(tx, created.id, { authorId: user.id, fromAmeris: false, body });
      return created;
    });
    await notifyOtherSide(ticket, user, { fromAmeris: false, title: `New support ticket ${ticket.number}`, body: subject });
    return res.status(201).json(ticket);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
