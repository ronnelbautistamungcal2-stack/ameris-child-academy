import prisma from "@/lib/prisma";
import { finishEnrollment } from "@/lib/subscriberEnrollment";

/**
 * POST /api/v1/solutions/enroll/:token/finish { sessionId }  (public)
 * Called by the page when Stripe sends them back. Asks Stripe whether the
 * Checkout session is paid and, if so, creates the account (the webhook may
 * already have). Returns { accountNumber, email }.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const token = String(req.query.token || "");
  const sessionId = String(req.body?.sessionId || "");
  const lead = token.length >= 16 ? await prisma.lead.findUnique({ where: { quoteToken: token }, select: { id: true } }) : null;
  if (!lead) return res.status(404).json({ error: "Quote not found" });
  if (!/^cs_(test|live)_\w+$/.test(sessionId)) return res.status(400).json({ error: "Missing payment reference" });
  try {
    const out = await finishEnrollment(sessionId);
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    // Only answer for this quote's own payment.
    const mine = await prisma.lead.findFirst({ where: { id: lead.id, subscriberAccountId: out.account.id }, select: { enrollment: true } });
    if (!mine) return res.status(404).json({ error: "Quote not found" });
    return res.status(200).json({ accountNumber: out.account.accountNumber, name: out.account.name, email: mine.enrollment?.email || null });
  } catch (err) {
    console.error("enroll finish", err?.stripe || err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : "We couldn't confirm the payment. Please refresh the page." });
  }
}
