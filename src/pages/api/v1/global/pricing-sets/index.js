import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { currentPricingSet, listPricingSets } from "@/lib/pricingServer";
import { DEFAULT_PRICING, validatePricing } from "@/lib/subscriptionPricing";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET  /api/v1/global/pricing-sets  -> { sets: [{ id, name, effectiveDate, current, data }] }
 * POST /api/v1/global/pricing-sets  { name, effectiveDate, data? }  "+ New Pricing Set"
 *      Starts from the set in effect today when no data is sent.
 * Global admin > Settings > Subscription Pricing (client 2026-11-10).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;

  if (req.method === "GET") return res.status(200).json({ sets: await listPricingSets() });

  if (req.method === "POST") {
    const body = req.body || {};
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: "Name the pricing set" });
    if (!DATE.test(String(body.effectiveDate || ""))) return res.status(400).json({ error: "Choose an effective date" });
    const parsed = validatePricing(body.data ?? (await currentPricingSet())?.data ?? DEFAULT_PRICING);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const created = await prisma.pricingSet.create({
      data: { name, effectiveDate: new Date(`${body.effectiveDate}T00:00:00.000Z`), data: parsed.data, updatedById: session.user.id },
    });
    return res.status(201).json({ id: created.id, sets: await listPricingSets() });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
