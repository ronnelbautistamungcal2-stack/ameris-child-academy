/**
 * Tuition ledger behind the parent Billing page.
 *
 * There is no invoice/payment table yet — Subscription only tracks the
 * center's own plan — so the statements, payments, card, and billing
 * preferences a family sees are generated here. Everything is derived from the
 * current month so the page never drifts into showing a stale "last payment";
 * edit the constants below to change the amounts, the billing day, or how far
 * back the history runs. When a real billing table lands, replace
 * buildTuitionLedger with the query and the page keeps working: it only reads
 * the shapes documented on each builder.
 */

/** Monthly tuition charged to the whole family, in cents. */
const MONTHLY_TUITION_CENTS = 112000;
/** Occasional before-care add-on, in cents. */
const BEFORE_CARE_CENTS = 6000;
/** How many closed months of history to show. */
const HISTORY_MONTHS = 8;
/** Day of the month a statement falls due. */
const DUE_DAY = 15;

/** Card on file. Replace with the payment-method record once one exists. */
export const PAYMENT_METHODS = [
  { id: "card-primary", brand: "Visa", last4: "1234", expMonth: 4, expYear: 2028, primary: true },
];

/** Family billing preferences. These are display-only until a table backs them. */
export const BILLING_PREFERENCES = {
  autopayEnrolled: false,
  paperlessStatements: true,
  emailNotifications: true,
};

export const STATEMENT_STATUS = {
  PAID: "Paid",
  OPEN: "Open",
  SCHEDULED: "Scheduled",
};

function monthName(date) {
  return date.toLocaleDateString(undefined, { month: "long" });
}

/** "2026-09" — the key the period selector and every filter compare on. */
export function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMoney(cents) {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/** "09/15/2026" — the compact form the ledger tables print. */
export function formatLedgerDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/** "Sep 15, 2026" — the form the summary cards print. */
export function formatLongDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Builds the family ledger.
 *
 * Returns { statements, payments, scheduledPayments }. A row is
 * { id, date, description, appliesTo, amountCents, status, dueDate? } where
 * appliesTo is "ALL" or an array of roster positions — the page resolves those
 * against the children it actually loaded, so the fake ledger always names real
 * children.
 */
export function buildTuitionLedger(referenceDate = new Date()) {
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = today.getFullYear();
  const month = today.getMonth();

  const statements = [];
  const payments = [];

  // Closed months: billed and settled on the due day.
  for (let back = HISTORY_MONTHS; back >= 1; back -= 1) {
    const billedOn = new Date(year, month - back, DUE_DAY);
    statements.push({
      id: `tuition-${monthKey(billedOn)}`,
      date: billedOn,
      description: "Monthly Tuition",
      appliesTo: "ALL",
      amountCents: MONTHLY_TUITION_CENTS,
      status: STATEMENT_STATUS.PAID,
    });
    payments.push({
      id: `payment-${monthKey(billedOn)}`,
      date: billedOn,
      description: "Monthly Tuition",
      appliesTo: "ALL",
      amountCents: MONTHLY_TUITION_CENTS,
      status: STATEMENT_STATUS.PAID,
    });

    // One add-on partway through the history so the Child(ren) column is not
    // uniformly "All Children".
    if (back === 2) {
      const addOnOn = new Date(year, month - back, 5);
      statements.push({
        id: `before-care-${monthKey(addOnOn)}`,
        date: addOnOn,
        description: "Before Care",
        appliesTo: [0, 2],
        amountCents: BEFORE_CARE_CENTS,
        status: STATEMENT_STATUS.PAID,
      });
      payments.push({
        id: `payment-before-care-${monthKey(addOnOn)}`,
        date: addOnOn,
        description: "Before Care",
        appliesTo: [0, 2],
        amountCents: BEFORE_CARE_CENTS,
        status: STATEMENT_STATUS.PAID,
      });
    }
  }

  // The open month: issued on the 1st, due on the billing day.
  const issuedOn = new Date(year, month, 1);
  statements.push({
    id: `tuition-${monthKey(issuedOn)}`,
    date: issuedOn,
    description: `${monthName(issuedOn)} Tuition`,
    appliesTo: "ALL",
    amountCents: MONTHLY_TUITION_CENTS,
    status: STATEMENT_STATUS.OPEN,
    dueDate: new Date(year, month, DUE_DAY),
  });

  // Nothing is queued while autopay is off; the tab shows its empty state.
  const scheduledPayments = BILLING_PREFERENCES.autopayEnrolled
    ? [
        {
          id: `scheduled-${monthKey(new Date(year, month + 1, DUE_DAY))}`,
          date: new Date(year, month + 1, DUE_DAY),
          description: "Monthly Tuition (AutoPay)",
          appliesTo: "ALL",
          amountCents: MONTHLY_TUITION_CENTS,
          status: STATEMENT_STATUS.SCHEDULED,
        },
      ]
    : [];

  return { statements, payments, scheduledPayments };
}

/** Distinct billing periods in the ledger, newest first. */
export function billingPeriodOptions(statements) {
  const seen = new Map();
  for (const row of statements) {
    const key = monthKey(row.date);
    if (!key || seen.has(key)) continue;
    seen.set(key, {
      key,
      label: new Date(row.date).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    });
  }
  return [...seen.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Rows in or before the selected period, newest first. */
export function rowsThroughPeriod(rows, periodKey) {
  return rows
    .filter((row) => !periodKey || monthKey(row.date) <= periodKey)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * The four numbers across the top of the page, all derived from the ledger so
 * the cards can never disagree with the table underneath them.
 */
export function summarizeBilling({ statements, payments, periodKey }) {
  const open = statements.filter((row) => row.status === STATEMENT_STATUS.OPEN);
  const openThroughPeriod = rowsThroughPeriod(open, periodKey);

  const currentBalanceCents = openThroughPeriod.reduce(
    (total, row) => total + row.amountCents,
    0,
  );
  const totalBalanceDueCents = open.reduce((total, row) => total + row.amountCents, 0);

  const nextDue = [...open]
    .filter((row) => row.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

  const lastPayment = rowsThroughPeriod(payments, periodKey)[0] || null;

  return {
    currentBalanceCents,
    totalBalanceDueCents,
    dueDate: nextDue?.dueDate || null,
    lastPayment,
  };
}
