// A small Stripe client over fetch (no SDK). Keys come from .env:
// STRIPE_SECRET_KEY (sk_test_… / sk_live_…) and, for the webhook,
// STRIPE_WEBHOOK_SECRET (whsec_…).
import crypto from "crypto";

const API = "https://api.stripe.com/v1";

export function stripeConfigured() {
  return /^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY || "");
}

export function stripeTestMode() {
  return String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
}

/** Stripe wants form fields: { a: { b: 1 } } -> "a[b]=1". */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") form(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function call(method, path, body, { idempotencyKey } = {}) {
  if (!stripeConfigured()) throw Object.assign(new Error("Online payment isn't set up yet."), { status: 503 });
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? form(body).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error ${res.status}`);
    err.status = 502;
    err.stripe = data?.error;
    throw err;
  }
  return data;
}

export const createCheckoutSession = (params) => call("POST", "/checkout/sessions", params);
export const getCheckoutSession = (id) => call("GET", `/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent`);
// The idempotency key makes a repeat (return page + webhook) return the same object.
export const createProduct = (params, idempotencyKey) => call("POST", "/products", params, { idempotencyKey });
export const createSubscription = (params, idempotencyKey) => call("POST", "/subscriptions", params, { idempotencyKey });

/**
 * Checks a webhook's Stripe-Signature header ("t=…,v1=…") against the raw
 * body. Returns the parsed event or null.
 */
export function verifyWebhook(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET, toleranceSec = 300) {
  if (!secret || !header) return null;
  const parts = Object.fromEntries(
    String(header)
      .split(",")
      .map((p) => p.split("="))
      .filter((p) => p.length === 2),
  );
  const signatures = String(header)
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const ok = signatures.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
