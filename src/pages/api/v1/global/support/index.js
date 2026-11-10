import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import {
  addTicketMessage,
  listRow,
  nextTicketNumber,
  notifyOtherSide,
  text,
  TICKET_STATUSES,
  ticketListInclude,
} from "@/lib/supportTickets";

// Ameris Solutions Customer Support queue: every subscriber's tickets.
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const status = String(req.query.status || "").toUpperCase();
    const q = String(req.query.q || "").trim();
    const search = q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
            { account: { name: { contains: q, mode: "insensitive" } } },
            { account: { accountNumber: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};
    const where = { ...search, ...(TICKET_STATUSES.includes(status) ? { status } : {}) };
    const [tickets, grouped, granted] = await Promise.all([
      prisma.supportTicket.findMany({ where, include: ticketListInclude, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.supportTicket.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
      prisma.supportAccessGrant.count({ where: { status: "GRANTED" } }),
    ]);
    const counts = { ALL: 0 };
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      counts.ALL += g._count._all;
    }
    counts.ACCESS_GRANTED = granted;
    return res.status(200).json({ tickets: tickets.map(listRow), counts });
  }

  // Ameris opens a ticket for a subscriber (for example after a phone call).
  if (req.method === "POST") {
    const accountId = String(req.body?.accountId || "");
    const subject = text(req.body?.subject, 200);
    const body = text(req.body?.body, 5000);
    const account = accountId ? await prisma.subscriberAccount.findUnique({ where: { id: accountId }, select: { id: true } }) : null;
    if (!account) return res.status(400).json({ error: "Pick a subscriber" });
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    if (!body) return res.status(400).json({ error: "Describe the problem" });
    const centerId = req.body?.centerId ? String(req.body.centerId) : null;
    if (centerId) {
      const center = await prisma.center.findFirst({ where: { id: centerId, subscriberAccountId: accountId }, select: { id: true } });
      if (!center) return res.status(400).json({ error: "That center isn't on the subscriber's account" });
    }
    const user = session.user;
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: { number: await nextTicketNumber(tx), accountId, centerId, subject, openedById: user.id },
      });
      await addTicketMessage(tx, created.id, { authorId: user.id, fromAmeris: true, body });
      return created;
    });
    await notifyOtherSide(ticket, user, { fromAmeris: true, title: `Ameris Solutions opened ticket ${ticket.number}`, body: subject });
    return res.status(201).json(ticket);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
