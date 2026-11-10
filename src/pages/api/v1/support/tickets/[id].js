import prisma from "@/lib/prisma";
import { requireSubscriberAdmin } from "@/lib/supportAuth";
import { addTicketMessage, notifyOtherSide, text, ticketDetailInclude } from "@/lib/supportTickets";

// One ticket for the subscriber: read it, reply, close or reopen it.
export default async function handler(req, res) {
  const user = await requireSubscriberAdmin(req, res);
  if (!user) return;
  const id = String(req.query.id || "");
  const ticket = await prisma.supportTicket.findFirst({ where: { id, accountId: user.subscriberAccountId } });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  if (req.method === "GET") {
    return res.status(200).json(await prisma.supportTicket.findUnique({ where: { id }, include: ticketDetailInclude }));
  }

  if (req.method === "POST") {
    const reply = text(req.body?.reply, 5000);
    const action = String(req.body?.action || "").toUpperCase();
    if (reply) {
      await prisma.$transaction(async (tx) => {
        await addTicketMessage(tx, id, { authorId: user.id, fromAmeris: false, body: reply });
        // A reply on a closed ticket opens it again.
        if (ticket.status === "CLOSED") await tx.supportTicket.update({ where: { id }, data: { status: "OPEN", closedAt: null } });
      });
      await notifyOtherSide(ticket, user, { fromAmeris: false, title: `Reply on ticket ${ticket.number}`, body: reply });
    } else if (action === "CLOSE" || action === "REOPEN") {
      const closing = action === "CLOSE";
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({ where: { id }, data: { status: closing ? "CLOSED" : "OPEN", closedAt: closing ? new Date() : null } });
        await addTicketMessage(tx, id, { authorId: user.id, fromAmeris: false, isEvent: true, body: closing ? "Ticket closed." : "Ticket reopened." });
      });
      await notifyOtherSide(ticket, user, { fromAmeris: false, title: `Ticket ${ticket.number} ${closing ? "closed" : "reopened"}`, body: ticket.subject });
    } else {
      return res.status(400).json({ error: "Send a reply, or an action of CLOSE or REOPEN" });
    }
    return res.status(200).json(await prisma.supportTicket.findUnique({ where: { id }, include: ticketDetailInclude }));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
