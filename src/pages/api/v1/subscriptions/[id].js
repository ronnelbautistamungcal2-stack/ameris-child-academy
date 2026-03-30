import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { badRequest, createApiHandler, forbidden, notFound, unauthorized } from "@/lib/api-error";
import { ensureObject, optionalBoolean, optionalDate, optionalPlainObject, optionalString } from "@/lib/validation";
import { buildSubscriptionPaymentInfo, normalizeSubscription, TIER_FEATURES } from "@/lib/subscriptions";

function getPaymentSections(body, existing) {
  const legacyPaymentInfo = optionalPlainObject(body, "paymentInfo", { nullable: true });
  const features =
    optionalPlainObject(body, "features", { nullable: true }) ||
    legacyPaymentInfo?.features ||
    existing?.paymentInfo?.features ||
    {};
  const billing =
    optionalPlainObject(body, "billing", { nullable: true }) ||
    legacyPaymentInfo?.billing ||
    existing?.paymentInfo?.billing ||
    {};
  return { features, billing };
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") {
    throw forbidden("Only admins can manage subscriptions");
  }

  const { id } = req.query;
  const existing = await prisma.subscription.findUnique({
    where: { id: String(id) },
    include: { center: true },
  });
  if (!existing) throw notFound("Subscription not found");

  if (req.method === "GET") {
    return res.status(200).json(normalizeSubscription(existing));
  }

  if (req.method === "DELETE") {
    await prisma.subscription.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  const body = ensureObject(req.body || {});
  const nextTier = optionalString(body, "tier");
  const tier = nextTier ? nextTier.toUpperCase() : existing.tier;
  if (!TIER_FEATURES[tier]) {
    throw badRequest(`tier must be one of: ${Object.keys(TIER_FEATURES).join(", ")}`, {
      field: "tier",
      allowed: Object.keys(TIER_FEATURES),
    });
  }

  const active = optionalBoolean(body, "active");
  const expiresAt = optionalDate(body, "expiresAt", { nullable: true });
  const { features, billing } = getPaymentSections(body, existing);
  const paymentInfo = buildSubscriptionPaymentInfo({ tier, features, billing });

  const updated = await prisma.subscription.update({
    where: { id: String(id) },
    data: {
      tier,
      active: active !== undefined ? active : undefined,
      expiresAt: expiresAt === undefined ? undefined : expiresAt,
      paymentInfo,
    },
    include: { center: true },
  });

  return res.status(200).json(normalizeSubscription(updated));
}, { methods: ["GET", "PUT", "DELETE"], logLabel: "subscriptions/[id] error:" });
