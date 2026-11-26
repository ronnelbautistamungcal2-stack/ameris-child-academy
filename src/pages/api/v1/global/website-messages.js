import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";

// Website Messages (client sheet 10-29 (11), row 53): what people send from
// the Ameris Solutions Contact Us page. They used to land in Sales & Leads as
// new leads; they're kept as leads with source CONTACT_FORM, listed here
// instead, and one can be moved to Sales & Leads.

const CONTACT_FORM = "CONTACT_FORM";

/**
 * GET   /api/v1/global/website-messages?q=  -> { messages }
 * PATCH /api/v1/global/website-messages { id, action: "toLead" | "read" | "unread" }
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SALES_LEADS");
  if (!session) return undefined;

  if (req.method === "GET") {
    const q = String(req.query.q || "").trim();
    const messages = await prisma.lead.findMany({
      where: {
        source: CONTACT_FORM,
        ...(q
          ? {
              OR: [
                { contactName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { centerName: { contains: q, mode: "insensitive" } },
                { about: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, number: true, status: true, contactName: true, email: true, phone: true, centerName: true, about: true, createdAt: true },
    });
    return res.status(200).json({ messages });
  }

  if (req.method === "PATCH") {
    const id = String(req.body?.id || "");
    const action = String(req.body?.action || "");
    const lead = await prisma.lead.findFirst({ where: { id, source: CONTACT_FORM } });
    if (!lead) return res.status(404).json({ error: "Message not found" });
    if (action === "toLead") {
      // Now a lead: shows in Sales & Leads as a New lead.
      await prisma.lead.update({
        where: { id },
        data: { source: "MANUAL", status: "NEW", activities: { create: { staffId: session.user.id, description: "Moved from Website Messages to Sales & Leads." } } },
      });
      return res.status(200).json({ ok: true, leadId: id });
    }
    if (action === "read" || action === "unread") {
      // NEW = unread; CONTACTED = read.
      await prisma.lead.update({ where: { id }, data: { status: action === "read" ? "CONTACTED" : "NEW" } });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).end();
}
