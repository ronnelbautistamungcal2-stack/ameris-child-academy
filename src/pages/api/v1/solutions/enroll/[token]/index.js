import prisma from "@/lib/prisma";
import { clientIp } from "@/lib/terms";
import { tooManyRequests } from "@/lib/leads";
import { enrollmentView, parseEnrollment, quoteExpired, siteOrigin, startCheckout } from "@/lib/subscriberEnrollment";

/**
 * /api/v1/solutions/enroll/:token  (public: the quote link)
 * GET  -> what the Complete Your Enrollment page shows (charges, agreement,
 *         whether they've already enrolled).
 * POST { fullName, email, password, confirmPassword, agree, agreementId }
 *      -> records the agreement and starts Stripe Checkout: { url }.
 */
export default async function handler(req, res) {
  const token = String(req.query.token || "");
  const lead = token.length >= 16 ? await prisma.lead.findUnique({ where: { quoteToken: token } }) : null;
  if (!lead || !lead.quoteData) return res.status(404).json({ error: "Quote not found" });

  if (req.method === "GET") return res.status(200).json(await enrollmentView(lead));

  if (req.method === "POST") {
    if (tooManyRequests(req, 10)) return res.status(429).json({ error: "Too many tries. Please wait a few minutes." });
    if (lead.subscriberAccountId) return res.status(409).json({ error: "This quote has already been used to enroll. Please log in." });
    if (quoteExpired(lead)) return res.status(409).json({ error: "This quote has expired. Please contact us for a new one." });
    const parsed = await parseEnrollment(req.body || {}, lead);
    if (parsed.error) return res.status(parsed.status || 400).json({ error: parsed.error });

    const now = new Date().toISOString();
    const enrollment = {
      ...parsed.data,
      acceptedAt: now,
      startedAt: now,
      ipAddress: clientIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
    };
    try {
      const session = await startCheckout(lead, enrollment, siteOrigin(req));
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          enrollment: { ...enrollment, checkoutSessionId: session.id },
          activities: {
            create: { description: `${enrollment.fullName} agreed to "${enrollment.agreement.name}" (${enrollment.agreement.version}) and went to payment.` },
          },
        },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error("enroll checkout", err?.stripe || err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "We couldn't start the payment. Please try again." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
