import prisma from "@/lib/prisma";
import { clientIp } from "@/lib/terms";
import { tooManyRequests } from "@/lib/leads";
import { enrollmentView, finishEnrollment, parseEnrollment, quoteExpired, refreshSigning, signingRequired, siteOrigin, startCheckout } from "@/lib/subscriberEnrollment";

/**
 * /api/v1/solutions/enroll/:token  (public: the quote link)
 * GET  -> what the Complete Your Enrollment page shows (charges, agreement,
 *         signing status, whether they've already enrolled).
 * POST -> starts Stripe Checkout: { url }.
 *      Home Daycare (and centers without DocuSign):
 *        { fullName, email, password, confirmPassword, agree, agreementId }
 *      Centers with DocuSign: {} once they've signed (POST .../sign first);
 *        the login chosen before signing is used.
 */
export default async function handler(req, res) {
  const token = String(req.query.token || "");
  let lead = token.length >= 16 ? await prisma.lead.findUnique({ where: { quoteToken: token } }) : null;
  if (!lead || !lead.quoteData) return res.status(404).json({ error: "Quote not found" });

  if (req.method === "GET") {
    if (!lead.subscriberAccountId) lead = await refreshSigning(lead).catch((err) => (console.error("enroll signing status", err?.docusign || err), lead));
    // A bank payment still clearing: ask Stripe again (works without the webhook too).
    if (!lead.subscriberAccountId && lead.enrollment?.payment?.status === "PROCESSING" && lead.enrollment.checkoutSessionId) {
      await finishEnrollment(lead.enrollment.checkoutSessionId).catch((err) => console.error("enroll bank status", err?.stripe || err));
      lead = await prisma.lead.findUnique({ where: { id: lead.id } });
    }
    return res.status(200).json(await enrollmentView(lead));
  }

  if (req.method === "POST") {
    if (tooManyRequests(req, 10)) return res.status(429).json({ error: "Too many tries. Please wait a few minutes." });
    if (lead.subscriberAccountId) return res.status(409).json({ error: "This quote has already been used to enroll. Please log in." });
    if (quoteExpired(lead)) return res.status(409).json({ error: "This quote has expired. Please contact us for a new one." });
    if (lead.enrollment?.payment?.status === "PROCESSING") {
      return res.status(409).json({ error: "Your bank payment is still processing. Your account will be ready once it clears." });
    }

    let enrollment;
    let activity;
    if (await signingRequired(lead)) {
      lead = await refreshSigning(lead).catch(() => lead);
      const e = lead.enrollment;
      if (e?.signing?.status !== "COMPLETED") return res.status(409).json({ error: "Please review and e-sign your agreement first." });
      if (await prisma.user.findUnique({ where: { email: e.email }, select: { id: true } })) {
        return res.status(409).json({ error: "That email already has an Ameris account. Please contact us to finish your enrollment." });
      }
      enrollment = { ...e, payment: undefined, startedAt: new Date().toISOString() };
      activity = `${e.fullName} went to payment after signing in DocuSign.`;
    } else {
      const parsed = await parseEnrollment(req.body || {}, lead);
      if (parsed.error) return res.status(parsed.status || 400).json({ error: parsed.error });
      const now = new Date().toISOString();
      enrollment = {
        ...parsed.data,
        acceptedAt: now,
        startedAt: now,
        ipAddress: clientIp(req),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
      };
      activity = `${enrollment.fullName} agreed to "${enrollment.agreement.name}" (${enrollment.agreement.version}) and went to payment.`;
    }
    try {
      const session = await startCheckout(lead, enrollment, siteOrigin(req));
      await prisma.lead.update({
        where: { id: lead.id },
        data: { enrollment: { ...enrollment, checkoutSessionId: session.id }, activities: { create: { description: activity } } },
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
