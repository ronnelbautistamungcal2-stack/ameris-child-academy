/**
 * Helpers for the parent Billing page. The statements and payments come from
 * /api/v1/billing/ledger (invoices, charges and payments); a row is
 * { id, date, description, appliesTo, amountCents, balanceCents?, status,
 * dueDate?, invoiceId? }. The card on file and billing preferences below are
 * still display-only until online payments exist.
 */

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

  // A partly paid statement only counts what is still owed.
  const owed = (row) => row.balanceCents ?? row.amountCents;
  const currentBalanceCents = openThroughPeriod.reduce((total, row) => total + owed(row), 0);
  const totalBalanceDueCents = open.reduce((total, row) => total + owed(row), 0);

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
