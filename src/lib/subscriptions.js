import { badRequest, apiError } from "@/lib/api-error";

export const FEATURE_KEYS = [
  "analytics",
  "messaging",
  "forms",
  "exports",
  "coachReports",
  "teacherMetrics",
  "pushNotifications",
  "billingPortal",
  "autoPay",
];

export const FEATURE_LABELS = {
  analytics: "Analytics",
  messaging: "Messaging",
  forms: "Forms",
  exports: "Exports",
  coachReports: "Coach reports",
  teacherMetrics: "Teacher metrics",
  pushNotifications: "Browser notifications",
  billingPortal: "Billing portal",
  autoPay: "Autopay",
};

const DEFAULT_FEATURES = {
  analytics: false,
  messaging: true,
  forms: true,
  exports: false,
  coachReports: false,
  teacherMetrics: true,
  pushNotifications: false,
  billingPortal: false,
  autoPay: false,
};

export const TIER_FEATURES = {
  TRIAL: {
    ...DEFAULT_FEATURES,
    analytics: true,
    coachReports: true,
  },
  BASIC: {
    ...DEFAULT_FEATURES,
  },
  PRO: {
    ...DEFAULT_FEATURES,
    analytics: true,
    exports: true,
    coachReports: true,
    pushNotifications: true,
    billingPortal: true,
  },
  ENTERPRISE: {
    ...DEFAULT_FEATURES,
    analytics: true,
    exports: true,
    coachReports: true,
    pushNotifications: true,
    billingPortal: true,
    autoPay: true,
  },
};

const EMPTY_BILLING = {
  provider: null,
  customerId: null,
  portalUrl: null,
  paymentLinkUrl: null,
  supportEmail: null,
  invoiceEmail: null,
  autopayEnabled: false,
  cardBrand: null,
  cardLast4: null,
};

function normalizeBooleanMap(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;

  for (const key of FEATURE_KEYS) {
    if (typeof value[key] === "boolean") {
      out[key] = value[key];
    }
  }

  return out;
}

export function normalizeSubscription(subscription) {
  if (!subscription) return null;

  const tier = typeof subscription.tier === "string" ? subscription.tier.toUpperCase() : "BASIC";
  const paymentInfo =
    subscription.paymentInfo && typeof subscription.paymentInfo === "object" && !Array.isArray(subscription.paymentInfo)
      ? subscription.paymentInfo
      : {};

  const features = {
    ...(TIER_FEATURES[tier] || DEFAULT_FEATURES),
    ...normalizeBooleanMap(paymentInfo.features),
  };

  const billing = {
    ...EMPTY_BILLING,
    ...(paymentInfo.billing && typeof paymentInfo.billing === "object" ? paymentInfo.billing : {}),
  };

  return {
    ...subscription,
    tier,
    features,
    billing: {
      provider: typeof billing.provider === "string" ? billing.provider : null,
      customerId: typeof billing.customerId === "string" ? billing.customerId : null,
      portalUrl: typeof billing.portalUrl === "string" ? billing.portalUrl : null,
      paymentLinkUrl: typeof billing.paymentLinkUrl === "string" ? billing.paymentLinkUrl : null,
      supportEmail: typeof billing.supportEmail === "string" ? billing.supportEmail : null,
      invoiceEmail: typeof billing.invoiceEmail === "string" ? billing.invoiceEmail : null,
      autopayEnabled: !!billing.autopayEnabled,
      cardBrand: typeof billing.cardBrand === "string" ? billing.cardBrand : null,
      cardLast4: typeof billing.cardLast4 === "string" ? billing.cardLast4 : null,
    },
    paymentInfo,
  };
}

export function getFeatureState(subscription, feature) {
  const normalized = normalizeSubscription(subscription);
  return !!normalized?.features?.[feature];
}

export function getSubscriptionFeatureSummary(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return {};
  return FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = !!normalized.features[key];
    return acc;
  }, {});
}

export function buildSubscriptionPaymentInfo(input = {}) {
  const tier = typeof input.tier === "string" ? input.tier.toUpperCase() : "BASIC";
  if (!TIER_FEATURES[tier]) {
    throw badRequest(`tier must be one of: ${Object.keys(TIER_FEATURES).join(", ")}`, {
      field: "tier",
      allowed: Object.keys(TIER_FEATURES),
    });
  }

  const featuresSource =
    input.features && typeof input.features === "object" && !Array.isArray(input.features)
      ? input.features
      : {};
  const billingSource =
    input.billing && typeof input.billing === "object" && !Array.isArray(input.billing)
      ? input.billing
      : {};

  return {
    features: FEATURE_KEYS.reduce((acc, key) => {
      if (typeof featuresSource[key] === "boolean") {
        acc[key] = featuresSource[key];
      }
      return acc;
    }, {}),
    billing: {
      provider: typeof billingSource.provider === "string" ? billingSource.provider.trim() || null : null,
      customerId: typeof billingSource.customerId === "string" ? billingSource.customerId.trim() || null : null,
      portalUrl: typeof billingSource.portalUrl === "string" ? billingSource.portalUrl.trim() || null : null,
      paymentLinkUrl:
        typeof billingSource.paymentLinkUrl === "string" ? billingSource.paymentLinkUrl.trim() || null : null,
      supportEmail:
        typeof billingSource.supportEmail === "string" ? billingSource.supportEmail.trim() || null : null,
      invoiceEmail:
        typeof billingSource.invoiceEmail === "string" ? billingSource.invoiceEmail.trim() || null : null,
      autopayEnabled: !!billingSource.autopayEnabled,
      cardBrand: typeof billingSource.cardBrand === "string" ? billingSource.cardBrand.trim() || null : null,
      cardLast4: typeof billingSource.cardLast4 === "string" ? billingSource.cardLast4.trim() || null : null,
    },
  };
}

export function assertActiveSubscription(subscription) {
  if (!subscription || !subscription.active) {
    throw apiError(402, "SUBSCRIPTION_INACTIVE", "Subscription inactive");
  }
  return normalizeSubscription(subscription);
}

export function assertSubscriptionFeature(subscription, feature, details = {}) {
  const normalized = assertActiveSubscription(subscription);
  if (!FEATURE_KEYS.includes(feature)) {
    throw badRequest(`Unknown feature: ${feature}`, { feature });
  }
  if (!normalized.features[feature]) {
    throw apiError(
      402,
      "FEATURE_DISABLED",
      `${FEATURE_LABELS[feature] || feature} is not enabled for this center`,
      {
        feature,
        tier: normalized.tier,
        ...details,
      },
    );
  }
  return normalized;
}
