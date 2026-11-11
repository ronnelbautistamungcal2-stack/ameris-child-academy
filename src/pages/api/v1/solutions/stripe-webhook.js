import { finishEnrollment } from "@/lib/subscriberEnrollment";
import { verifyWebhook } from "@/lib/stripe";

// Stripe signs the raw body, so Next mustn't parse it.
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * POST /api/v1/solutions/stripe-webhook  (called by Stripe)
 * Point a Stripe webhook here for "checkout.session.completed" and put its
 * signing secret in STRIPE_WEBHOOK_SECRET. Creates the account for a paid
 * enrollment even if the person closes the tab before coming back.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook not set up" });
  const event = verifyWebhook(await rawBody(req), req.headers["stripe-signature"]);
  if (!event) return res.status(400).json({ error: "Bad signature" });

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const session = event.data?.object;
    if (session?.metadata?.leadId) {
      try {
        const out = await finishEnrollment(session.id);
        if (out.error && out.status !== 409) console.warn("stripe webhook", out.error);
      } catch (err) {
        console.error("stripe webhook", err?.stripe || err);
        return res.status(500).json({ error: "Try again" }); // Stripe retries
      }
    }
  }
  return res.status(200).json({ received: true });
}
