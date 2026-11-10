import prisma from "@/lib/prisma";

/**
 * GET /api/v1/solutions/quotes/:token  (public: the link in the quote email)
 * The quote Ameris generated for a lead: who it's for, the priced lines, the
 * curriculum details and the dates. Only what the quote page shows.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const token = String(req.query.token || "");
  if (token.length < 16) return res.status(404).json({ error: "Quote not found" });
  const lead = await prisma.lead.findUnique({ where: { quoteToken: token } });
  if (!lead || !lead.quoteData) return res.status(404).json({ error: "Quote not found" });
  const expired = lead.quoteExpiresAt && new Date(lead.quoteExpiresAt).getTime() + 86400000 < Date.now();
  return res.status(200).json({
    number: lead.quoteNumber,
    date: lead.quoteDate,
    expiresAt: lead.quoteExpiresAt,
    expired: Boolean(expired),
    status: lead.quoteStatus,
    preparedFor: {
      centerName: lead.centerName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      location: lead.location,
    },
    quote: lead.quoteData,
  });
}
