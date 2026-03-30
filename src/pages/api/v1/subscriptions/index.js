import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { badRequest, createApiHandler, forbidden, notFound, unauthorized } from "@/lib/api-error";
import { ensureObject, optionalBoolean, optionalDate, optionalPlainObject, requiredString } from "@/lib/validation";
import { buildSubscriptionPaymentInfo, normalizeSubscription, TIER_FEATURES } from "@/lib/subscriptions";

function getPaymentSections(body) {
  const legacyPaymentInfo = optionalPlainObject(body, "paymentInfo", { nullable: true }) || {};
  const features = optionalPlainObject(body, "features", { nullable: true }) || legacyPaymentInfo.features || {};
  const billing = optionalPlainObject(body, "billing", { nullable: true }) || legacyPaymentInfo.billing || {};
  return { features, billing };
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") {
    throw forbidden("Only admins can manage subscriptions");
  }

  if (req.method === "GET") {
    const subscriptions = await prisma.subscription.findMany({
      include: { center: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(subscriptions.map((subscription) => normalizeSubscription(subscription)));
  }

  const body = ensureObject(req.body || {});
  const centerId = requiredString(body, "centerId");
  const tier = requiredString(body, "tier").toUpperCase();
  if (!TIER_FEATURES[tier]) {
    throw badRequest(`tier must be one of: ${Object.keys(TIER_FEATURES).join(", ")}`, {
      field: "tier",
      allowed: Object.keys(TIER_FEATURES),
    });
  }

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) throw notFound("Center not found");

  const active = optionalBoolean(body, "active");
  const expiresAt = optionalDate(body, "expiresAt", { nullable: true });
  const { features, billing } = getPaymentSections(body);
  const paymentInfo = buildSubscriptionPaymentInfo({ tier, features, billing });

  const subscription = await prisma.subscription.upsert({
    where: { centerId },
    create: {
      centerId,
      tier,
      active: active !== undefined ? active : true,
      expiresAt: expiresAt ?? null,
      paymentInfo,
    },
    update: {
      tier,
      active: active !== undefined ? active : undefined,
      expiresAt: expiresAt === undefined ? undefined : expiresAt,
      paymentInfo,
    },
    include: { center: true },
  });

  return res.status(200).json(normalizeSubscription(subscription));
}, { methods: ["GET", "POST"], logLabel: "subscriptions/index error:" });
