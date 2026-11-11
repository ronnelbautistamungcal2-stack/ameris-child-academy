// Subscriber enrollment: the website's Complete Your Enrollment page
// (client mockup Home-Pages-07, 2026-11-12). Not child enrollment (enrollment.js).
// A lead with a quote reviews the plan, agrees to the Subscriber Agreement,
// chooses the login for their first administrator and pays through Stripe
// Checkout. Once Stripe says it's paid (return page or webhook, whichever
// comes first), the subscriber account, its first center and the
// administrator are created.
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { currentPricingSet } from "@/lib/pricingServer";
import { FULL_MONTH_THROUGH_DAY, rangeFor } from "@/lib/subscriptionPricing";
import { getAgreements } from "@/lib/globalSettings";
import { currentDocuments } from "@/lib/terms";
import { nextAccountNumber } from "@/lib/subscriberAccounts";
import { globalAdminIds, notify } from "@/lib/supportTickets";
import { createCheckoutSession, createProduct, createSubscription, getCheckoutSession } from "@/lib/stripe";

export const INITIAL_TERM_MONTHS = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 86400000;

export function quoteExpired(lead, now = Date.now()) {
  return Boolean(lead.quoteExpiresAt && new Date(lead.quoteExpiresAt).getTime() + DAY < now);
}

const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

/**
 * What they pay today and after, from the quote's prices (the quote is what
 * they agreed to). Monthly: today pays the first month (half after the 15th),
 * then the full month on the 1st of every month. Annual: today pays the year.
 */
export function enrollmentCharges(quoteData, today = new Date()) {
  const annual = quoteData?.billingCycle === "ANNUAL";
  const monthly = Number(quoteData?.monthly) || 0;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (annual) {
    const year = Number(quoteData.periodTotal) || monthly * 12;
    return {
      billingCycle: "ANNUAL",
      recurringAmount: year,
      interval: "year",
      dueToday: year,
      dueTodayNote: "First year (12 months)",
      startDate: start,
      nextBillingDate: addMonths(start, 12),
      renewalDate: addMonths(start, INITIAL_TERM_MONTHS),
    };
  }
  const half = today.getDate() > FULL_MONTH_THROUGH_DAY;
  const firstOfNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthName = start.toLocaleString("en-US", { month: "long", year: "numeric" });
  return {
    billingCycle: "MONTHLY",
    recurringAmount: monthly,
    interval: "month",
    dueToday: half ? Math.round(monthly / 2) : monthly,
    dueTodayNote: half ? `Half of ${monthName} (signed up after the ${FULL_MONTH_THROUGH_DAY}th)` : `${monthName} (full month)`,
    startDate: start,
    nextBillingDate: firstOfNext,
    renewalDate: addMonths(start, INITIAL_TERM_MONTHS),
  };
}

/**
 * The agreement they accept. Home Daycare: the "Subscriber Agreement (Home
 * Daycare)" text from Terms & Agreements when one is published. Otherwise
 * (and for centers until DocuSign is connected): the current Subscriber
 * Agreement file from Settings > General.
 */
export async function enrollmentAgreement(programType, db = prisma) {
  const docs = await currentDocuments(["SUBSCRIBER_AGREEMENT"], db);
  const text = docs.SUBSCRIBER_AGREEMENT;
  const asText = text && { source: "TERMS", id: text.id, name: text.title, version: text.version, body: text.body };
  if (programType === "HOME_DAYCARE" && asText) return asText;
  const file = (await getAgreements(db)).find((a) => a.current);
  if (file) return { source: "FILE", id: file.id, name: file.name, version: file.version, effectiveDate: file.effectiveDate, url: file.fileUrl };
  return asText || null;
}

// Server-local calendar days as "YYYY-MM-DD", so every browser shows the same date.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const datesAsDays = (c) => ({ ...c, startDate: ymd(c.startDate), nextBillingDate: ymd(c.nextBillingDate), renewalDate: ymd(c.renewalDate) });

/** The public view of a lead's enrollment for the page. */
export async function enrollmentView(lead, db = prisma) {
  const sel = lead.pricingSelection || {};
  const account = lead.subscriberAccountId
    ? await db.subscriberAccount.findUnique({ where: { id: lead.subscriberAccountId }, select: { accountNumber: true, name: true } })
    : null;
  const agreement = await enrollmentAgreement(sel.programType || lead.quoteData?.programType, db);
  return {
    enrolled: Boolean(account),
    account,
    expired: quoteExpired(lead),
    programType: sel.programType || lead.quoteData?.programType || "CENTER",
    charges: datesAsDays(enrollmentCharges(lead.quoteData)),
    initialTermMonths: INITIAL_TERM_MONTHS,
    agreement,
    contact: { fullName: lead.contactName, email: lead.email },
  };
}

/** Checks the form and returns { data } or { error, status }. */
export async function parseEnrollment(body, lead, db = prisma) {
  const fullName = String(body.fullName || "").trim().slice(0, 150);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password || "");
  if (!fullName) return { error: "Full name is required" };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address" };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters" };
  if (body.confirmPassword !== undefined && body.confirmPassword !== password) return { error: "The passwords don't match" };
  const agreement = await enrollmentAgreement(lead.pricingSelection?.programType || lead.quoteData?.programType, db);
  if (!agreement) return { error: "The Subscriber Agreement isn't published yet. Please contact us to finish your enrollment.", status: 409 };
  if (body.agreementId !== agreement.id) return { error: "The agreement was updated. Please reload the page and review it again.", status: 409 };
  if (body.agree !== true) return { error: "Please agree to the Subscriber Agreement to continue" };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "That email already has an Ameris account. Use a different email for this administrator, or contact us.", status: 409 };
  }
  const { body: _omit, ...agreementRecord } = agreement;
  return { data: { fullName, email, passwordHash: await bcrypt.hash(password, 10), agreement: agreementRecord } };
}

/** Where Stripe sends them back. */
export function siteOrigin(req) {
  const fixed = process.env.PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  if (fixed) return fixed.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

const subscriptionLabel = (lead) => `Ameris Solutions subscription (${lead.quoteNumber})`;
const dollars = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

/**
 * Starts Stripe Checkout for the first payment (full or half month, or the
 * year) and saves the card. Stripe can't mix a one-time first payment with a
 * subscription that bills from the 1st, so the subscription is started by
 * finishEnrollment once this is paid. Returns the session (url, id).
 */
export async function startCheckout(lead, enrollment, origin) {
  const c = enrollmentCharges(lead.quoteData);
  if (!(c.recurringAmount > 0) || !(c.dueToday > 0)) throw Object.assign(new Error("This quote has no amount to pay. Please contact us."), { status: 409 });
  const back = `${origin}/solutions/enroll/${encodeURIComponent(lead.quoteToken)}`;
  const metadata = { leadId: lead.id, quoteNumber: lead.quoteNumber };
  const then =
    c.billingCycle === "ANNUAL"
      ? `then ${dollars(c.recurringAmount)} each year from ${c.nextBillingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : `then ${dollars(c.recurringAmount)} on the 1st of each month from ${c.nextBillingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  return createCheckoutSession({
    mode: "payment",
    // Always US dollars: the subscription that follows is billed in USD.
    adaptive_pricing: { enabled: false },
    // Cards only: bank payments take days to clear and the account is made on payment.
    payment_method_types: ["card"],
    customer_creation: "always",
    customer_email: enrollment.email,
    client_reference_id: lead.id,
    metadata,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: c.dueToday,
          product_data: { name: `${subscriptionLabel(lead)}: ${c.dueTodayNote}`, description: `${lead.centerName}. First payment, ${then}.` },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: { setup_future_usage: "off_session", metadata, description: `${subscriptionLabel(lead)}: first payment` },
    custom_text: { submit: { message: `Your card is saved for the subscription: ${then}, renewing automatically every ${INITIAL_TERM_MONTHS} months.` } },
    success_url: `${back}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}?canceled=1`,
  });
}

/** Starts the recurring subscription on the card from the first payment. */
async function startSubscription(lead, session, c) {
  const pi = session.payment_intent;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const paymentMethod = typeof pi?.payment_method === "string" ? pi.payment_method : pi?.payment_method?.id;
  if (!customer || !paymentMethod) throw new Error("Stripe didn't return the customer or card");
  const metadata = { leadId: lead.id, quoteNumber: lead.quoteNumber };
  const product = await createProduct({ name: `${subscriptionLabel(lead)}: ${lead.centerName}`, metadata }, `enroll-product-${session.id}`);
  return createSubscription(
    {
      customer,
      default_payment_method: paymentMethod,
      items: [{ price_data: { currency: "usd", product: product.id, unit_amount: c.recurringAmount, recurring: { interval: c.interval } } }],
      // Today's payment covers the time until then.
      billing_cycle_anchor: Math.floor(c.nextBillingDate.getTime() / 1000),
      proration_behavior: "none",
      metadata,
    },
    `enroll-subscription-${session.id}`,
  );
}

/**
 * Creates the subscriber account once Stripe says the Checkout session is
 * paid. Safe to call more than once (return page and webhook): the session id
 * is unique on the account. Returns { account } or { error, status }.
 */
export async function finishEnrollment(sessionId, db = prisma) {
  const session = await getCheckoutSession(sessionId);
  const leadId = session?.metadata?.leadId;
  if (!leadId) return { error: "This payment isn't for an enrollment", status: 404 };
  if (session.status !== "complete" || !["paid", "no_payment_required"].includes(session.payment_status)) {
    return { error: "The payment isn't finished yet", status: 409 };
  }
  const done = await db.subscriberAccount.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (done) return { account: done };
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Quote not found", status: 404 };
  if (lead.subscriberAccountId) {
    return { account: await db.subscriberAccount.findUnique({ where: { id: lead.subscriberAccountId } }) };
  }
  const e = lead.enrollment || {};
  if (!e.email || !e.passwordHash) return { error: "The enrollment details are missing. Please contact us.", status: 409 };

  const c = enrollmentCharges(lead.quoteData, e.startedAt ? new Date(e.startedAt) : new Date());
  const set = await currentPricingSet(db);
  const children = lead.pricingSelection?.children;
  const maxChildren = (set && rangeFor(set.data, children)?.to) || children || null;
  const emailTaken = Boolean(await db.user.findUnique({ where: { email: e.email }, select: { id: true } }));
  const paid = dollars(session.amount_total);

  let account;
  let adminId = null;
  try {
    account = await db.$transaction(async (tx) => {
      const created = await tx.subscriberAccount.create({
        data: {
          accountNumber: await nextAccountNumber(tx),
          name: lead.centerName,
          status: "ACTIVE",
          addOns: lead.addOns || [],
          pricingSelection: lead.pricingSelection || undefined,
          maxCenters: lead.locations || 1,
          maxChildren,
          startDate: c.startDate,
          renewalDate: c.renewalDate,
          autoRenew: true,
          activatedAt: new Date(),
          contactName: lead.contactName,
          contactEmail: lead.email,
          phone: lead.phone,
          address: lead.location,
          billingCycle: c.billingCycle,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
          stripeCheckoutSessionId: session.id,
        },
      });
      const center = await tx.center.create({ data: { name: lead.centerName, subscriberAccountId: created.id } });
      if (!emailTaken) {
        const admin = await tx.user.create({
          data: {
            email: e.email,
            name: e.fullName,
            password: e.passwordHash,
            role: "ADMIN",
            roles: ["ADMIN"],
            subscriberAccountId: created.id,
            centers: { create: { centerId: center.id, role: "ADMIN" } },
          },
        });
        adminId = admin.id;
      }
      const a = e.agreement || {};
      const notes = [
        `Enrolled online from quote ${lead.quoteNumber}; paid ${paid} by card (Stripe). Billing ${c.billingCycle === "ANNUAL" ? "annual" : "monthly"}.`,
        `${e.fullName} (${e.email}) agreed to "${a.name}" version ${a.version} on ${new Date(e.acceptedAt).toLocaleString("en-US")} from ${e.ipAddress || "unknown IP"}.`,
        emailTaken
          ? `No administrator was created: ${e.email} already had an Ameris account. Add the administrator by hand.`
          : `Center "${lead.centerName}" and administrator ${e.email} created.`,
      ];
      for (const description of notes) await tx.subscriberAccountNote.create({ data: { accountId: created.id, description } });
      const { passwordHash: _p, ...kept } = e;
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "WON",
          quoteStatus: "ACCEPTED",
          subscriberAccountId: created.id,
          enrollment: { ...kept, checkoutSessionId: session.id, paidAt: new Date().toISOString(), amountPaid: session.amount_total, accountNumber: created.accountNumber },
          activities: { create: { description: `Enrolled online and paid ${paid}. Account ${created.accountNumber} created.` } },
        },
      });
      return created;
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const again = await db.subscriberAccount.findUnique({ where: { stripeCheckoutSessionId: session.id } });
      if (again) return { account: again };
    }
    throw err;
  }

  // The recurring part. If Stripe refuses, the account still exists (they
  // paid); the Ameris team starts the subscription in Stripe themselves.
  try {
    const sub = await startSubscription(lead, session, c);
    account = await db.subscriberAccount.update({ where: { id: account.id }, data: { stripeSubscriptionId: sub.id } });
  } catch (err) {
    console.error("enroll subscription", err?.stripe || err);
    await db.subscriberAccountNote.create({
      data: { accountId: account.id, description: `The recurring Stripe subscription couldn't be started (${err.message}). Set it up in Stripe for this customer.` },
    });
  }

  if (adminId && e.agreement?.source === "TERMS") {
    await db.termsAcceptance
      .create({
        data: {
          documentId: e.agreement.id,
          userId: adminId,
          subscriberAccountId: account.id,
          role: "ADMIN",
          ipAddress: e.ipAddress || null,
          userAgent: e.userAgent || null,
          acceptedAt: new Date(e.acceptedAt),
        },
      })
      .catch(() => null);
  }
  await notify(await globalAdminIds(db), null, {
    title: "New subscriber enrolled",
    body: `${lead.centerName} enrolled online (${account.accountNumber}) and paid ${paid}.`,
    link: "/global/subscribers",
  }).catch(() => null);
  return { account };
}
