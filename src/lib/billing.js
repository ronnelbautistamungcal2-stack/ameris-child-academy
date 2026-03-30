import { normalizeSubscription } from "@/lib/subscriptions";

export function getBillingSummaryForCenter(center) {
  const subscription = normalizeSubscription(center?.subscription);
  if (!subscription) {
    return {
      centerId: center?.id || null,
      centerName: center?.name || "",
      active: false,
      tier: null,
      expiresAt: null,
      features: {},
      provider: null,
      billingPortalEnabled: false,
      paymentLinkEnabled: false,
      autopayEnabled: false,
      cardLabel: null,
      actions: {
        portalUrl: null,
        paymentLinkUrl: null,
      },
      supportEmail: null,
      invoiceEmail: null,
    };
  }

  const brand = subscription.billing.cardBrand;
  const last4 = subscription.billing.cardLast4;
  const cardLabel =
    brand && last4 ? `${brand.toUpperCase()} ending in ${last4}` : null;

  return {
    centerId: center.id,
    centerName: center.name,
    active: !!subscription.active,
    tier: subscription.tier,
    expiresAt: subscription.expiresAt || null,
    features: subscription.features,
    provider: subscription.billing.provider,
    billingPortalEnabled: !!subscription.features.billingPortal && !!subscription.billing.portalUrl,
    paymentLinkEnabled: !!subscription.billing.paymentLinkUrl,
    autopayEnabled: !!subscription.billing.autopayEnabled,
    cardLabel,
    actions: {
      portalUrl: subscription.billing.portalUrl,
      paymentLinkUrl: subscription.billing.paymentLinkUrl,
    },
    supportEmail: subscription.billing.supportEmail,
    invoiceEmail: subscription.billing.invoiceEmail,
  };
}
