import prisma from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { listPricingSets } from "@/lib/pricingServer";
import { validatePricing } from "@/lib/subscriptionPricing";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PUT    /api/v1/global/pricing-sets/:id  { name?, effectiveDate?, data? }  Save Changes
 * DELETE /api/v1/global/pricing-sets/:id  (not the last set)
 * Responds { sets } (all sets, as the GET list).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "SETTINGS");
  if (!session) return undefined;
  const id = String(req.query.id || "");
  const set = await prisma.pricingSet.findUnique({ where: { id } });
  if (!set) return res.status(404).json({ error: "Pricing set not found" });

  if (req.method === "PUT") {
    const body = req.body || {};
    const data = { updatedById: session.user.id };
    if (body.name !== undefined) {
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: "Name the pricing set" });
      data.name = name;
    }
    if (body.effectiveDate !== undefined) {
      if (!DATE.test(String(body.effectiveDate || ""))) return res.status(400).json({ error: "Choose an effective date" });
      data.effectiveDate = new Date(`${body.effectiveDate}T00:00:00.000Z`);
    }
    if (body.data !== undefined) {
      const parsed = validatePricing(body.data);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      data.data = parsed.data;
    }
    await prisma.pricingSet.update({ where: { id }, data });
    return res.status(200).json({ sets: await listPricingSets() });
  }

  if (req.method === "DELETE") {
    if ((await prisma.pricingSet.count()) <= 1) return res.status(400).json({ error: "Keep at least one pricing set" });
    await prisma.pricingSet.delete({ where: { id } });
    return res.status(200).json({ sets: await listPricingSets() });
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
