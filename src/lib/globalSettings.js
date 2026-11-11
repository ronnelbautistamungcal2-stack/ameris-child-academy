// Global admin > Settings > General (client mockup 2026-11-06). Stored as
// GlobalSetting rows: "general" (company, email, notifications, automated
// notices) and "agreements" (subscriber agreement versions).
import prisma from "@/lib/prisma";

export const GENERAL_DEFAULTS = {
  company: {
    name: "Ameris Solutions",
    dba: "Kingston Laboratories LLC",
    email: "info@amerissolutions.com",
    phone: "(801) 555-1234",
    website: "www.amerissolutions.com",
  },
  email: { fromName: "Ameris Solutions", fromEmail: "no-reply@amerissolutions.com", replyTo: "support@amerissolutions.com" },
  notifications: { newLeads: true, supportMessages: true, payments: true, agreements: true, systemUpdates: false },
  automated: { paymentReminderDaysBefore: 3, pastDueDaysAfter: 1, suspensionDaysAfter: 10, renewalReminderDaysBefore: 30 },
};

export const NOTIFICATION_LABELS = {
  newLeads: "New leads and quote requests",
  supportMessages: "New customer support messages",
  payments: "Subscription and payment updates",
  agreements: "Agreement updates",
  systemUpdates: "System updates and announcements",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

/** Merges a saved value over the defaults so new fields always exist. */
function withDefaults(saved) {
  const v = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(Object.entries(GENERAL_DEFAULTS).map(([k, d]) => [k, { ...d, ...(v[k] || {}) }]));
}

export async function getGeneral(db = prisma) {
  const row = await db.globalSetting.findUnique({ where: { key: "general" } });
  return withDefaults(row?.value);
}

/** Checks the General tab. Returns { data } or { error }. */
export function validateGeneral(input) {
  const v = withDefaults(input);
  const company = Object.fromEntries(Object.keys(GENERAL_DEFAULTS.company).map((k) => [k, str(v.company[k])]));
  if (!company.name) return { error: "Company Name is required" };
  if (!EMAIL.test(company.email)) return { error: "Enter a valid company email" };
  if (!company.phone) return { error: "Phone is required" };
  const email = Object.fromEntries(Object.keys(GENERAL_DEFAULTS.email).map((k) => [k, str(v.email[k])]));
  if (!email.fromName) return { error: "Enter the From Name" };
  if (!EMAIL.test(email.fromEmail) || !EMAIL.test(email.replyTo)) return { error: "Enter valid From and Reply-To emails" };
  const notifications = Object.fromEntries(Object.keys(GENERAL_DEFAULTS.notifications).map((k) => [k, Boolean(v.notifications[k])]));
  const automated = {};
  for (const k of Object.keys(GENERAL_DEFAULTS.automated)) {
    const n = Number(v.automated[k]);
    if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "Automated notification days must be whole numbers from 0 to 365" };
    automated[k] = n;
  }
  return { data: { company, email, notifications, automated } };
}

/** Subscriber agreement versions: [{ id, name, version, effectiveDate, fileUrl, current }] (newest first). */
export async function getAgreements(db = prisma) {
  const row = await db.globalSetting.findUnique({ where: { key: "agreements" } });
  const list = Array.isArray(row?.value) ? row.value : [];
  return [...list].sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)));
}

export async function saveAgreements(list, userId, db = prisma) {
  await db.globalSetting.upsert({
    where: { key: "agreements" },
    create: { key: "agreements", value: list, updatedById: userId },
    update: { value: list, updatedById: userId },
  });
}
