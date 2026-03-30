import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createApiHandler,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api-error";
import { ensureObject, requiredString } from "@/lib/validation";
import { assertActiveSubscription, assertSubscriptionFeature, normalizeSubscription } from "@/lib/subscriptions";

async function userCanAccessCenter(session, centerId) {
  if (session.user.role === "ADMIN") return true;
  if (session.user.role === "PARENT") {
    const child = await prisma.child.findFirst({
      where: { parentId: session.user.id, centerId },
      select: { id: true },
    });
    if (child) return true;
  }
  return hasAccessToCenter(session.user.id, centerId);
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  const body = ensureObject(req.body || {});
  const centerId = requiredString(body, "centerId");

  const center = await prisma.center.findUnique({
    where: { id: centerId },
    include: { subscription: true },
  });
  if (!center) throw notFound("Center not found");

  const allowed = await userCanAccessCenter(session, centerId);
  if (!allowed) throw forbidden();

  const subscription = assertActiveSubscription(center.subscription);

  if (subscription.billing.portalUrl) {
    assertSubscriptionFeature(subscription, "billingPortal", { centerId });
    return res.status(200).json({
      mode: "portal",
      url: subscription.billing.portalUrl,
      provider: subscription.billing.provider,
    });
  }

  if (subscription.billing.paymentLinkUrl) {
    return res.status(200).json({
      mode: "payment_link",
      url: subscription.billing.paymentLinkUrl,
      provider: subscription.billing.provider,
    });
  }

  const normalized = normalizeSubscription(subscription);
  return res.status(200).json({
    mode: "support",
    url: null,
    provider: normalized.billing.provider,
    supportEmail: normalized.billing.supportEmail,
  });
}, { methods: ["POST"], logLabel: "billing/portal error:" });
