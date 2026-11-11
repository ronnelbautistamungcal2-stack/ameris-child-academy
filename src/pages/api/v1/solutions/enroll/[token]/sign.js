import prisma from "@/lib/prisma";
import { clientIp } from "@/lib/terms";
import { tooManyRequests } from "@/lib/leads";
import { parseEnrollment, quoteExpired, signingRequired, siteOrigin, startSigning } from "@/lib/subscriberEnrollment";

/**
 * POST /api/v1/solutions/enroll/:token/sign  (public: centers)
 * { fullName, email, password, confirmPassword, agreementId }
 * Saves the administrator login and opens DocuSign for the Order Form and
 * Subscriber Agreement: { url }. DocuSign sends them back to the page with
 * ?signing=1, and the page's GET picks up the signed status.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const token = String(req.query.token || "");
  const lead = token.length >= 16 ? await prisma.lead.findUnique({ where: { quoteToken: token } }) : null;
  if (!lead || !lead.quoteData) return res.status(404).json({ error: "Quote not found" });
  if (tooManyRequests(req, 10)) return res.status(429).json({ error: "Too many tries. Please wait a few minutes." });
  if (lead.subscriberAccountId) return res.status(409).json({ error: "This quote has already been used to enroll. Please log in." });
  if (quoteExpired(lead)) return res.status(409).json({ error: "This quote has expired. Please contact us for a new one." });
  if (!signingRequired(lead)) return res.status(409).json({ error: "This plan is agreed to with the \"I agree\" box." });
  if (lead.enrollment?.signing?.status === "COMPLETED") return res.status(409).json({ error: "The agreement is already signed. Continue to payment." });

  const parsed = await parseEnrollment(req.body || {}, lead, prisma, { signing: true });
  if (parsed.error) return res.status(parsed.status || 400).json({ error: parsed.error });

  try {
    const { envelopeId, url } = await startSigning(lead, parsed.data, siteOrigin(req));
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        enrollment: {
          ...parsed.data,
          ipAddress: clientIp(req),
          userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
          signing: { envelopeId, status: "SENT", sentAt: new Date().toISOString() },
        },
        activities: { create: { description: `${parsed.data.fullName} opened the agreement in DocuSign to sign.` } },
      },
    });
    return res.status(200).json({ url });
  } catch (err) {
    console.error("enroll signing", err?.docusign || err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : "We couldn't open the agreement for signing. Please try again." });
  }
}
