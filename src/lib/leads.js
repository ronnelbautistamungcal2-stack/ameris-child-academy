// Sales & Leads (client mockups 2026-11-06, priority 2026-11-11). Shared by
// the website forms (Request a Quote, Contact Us) and the Global admin page.
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { currentPricingSet, parsePricingSelection } from "@/lib/pricingServer";
import { PRICED_ADD_ONS, classroomCounts, quote } from "@/lib/subscriptionPricing";
import { globalAdminIds, notify } from "@/lib/supportTickets";

export const LEAD_STATUSES = [
  { value: "NEW", label: "New Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUOTE_SENT", label: "Quote Sent" },
  { value: "FOLLOW_UP", label: "Follow-Up" },
  { value: "PENDING_DECISION", label: "Pending Decision" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];
export const LEAD_SOURCES = { QUOTE_REQUEST: "Request a Quote", CONTACT_FORM: "Contact Us", MANUAL: "Added by staff" };
export const BEST_TIMES = ["Morning (8 AM – 12 PM)", "Afternoon (12 PM – 4 PM)", "Evening (4 PM – 6 PM)", "Any time"];
export const ADD_ON_KEYS = [...PRICED_ADD_ONS.map((a) => a.key), "CURRICULUM"];
export const QUOTE_VALID_DAYS = 14;

const text = (v, max = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks a lead from a form. `website` is the public Request a Quote / Contact
 * Us form (stricter, no status). Returns { data } or { error }.
 */
export function parseLeadInput(body = {}, { create = false, website = false } = {}) {
  const data = {};
  const required = { centerName: "Program/Center name", contactName: "Your name", email: "Email address" };
  for (const [key, label] of Object.entries(required)) {
    if (body[key] === undefined && !create) continue;
    const v = text(body[key], key === "email" ? 200 : 150);
    if (!v) return { error: `${label} is required` };
    data[key] = key === "email" ? v.toLowerCase() : v;
  }
  if (data.email && !EMAIL.test(data.email)) return { error: "Enter a valid email address" };
  for (const key of ["phone", "bestTime", "location"]) if (body[key] !== undefined) data[key] = text(body[key], 120);
  if (body.about !== undefined) data.about = text(body.about, 4000);
  if (body.notes !== undefined && !website) data.notes = text(body.notes, 4000);
  if (body.locations !== undefined) {
    const n = body.locations === "" || body.locations == null ? null : Number(body.locations);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 1000)) return { error: "Number of locations must be a whole number, at least 1" };
    if (website && n === null) return { error: "Number of locations/centers is required" };
    data.locations = n;
  }
  if (body.addOns !== undefined) data.addOns = ADD_ON_KEYS.filter((k) => (Array.isArray(body.addOns) ? body.addOns : []).includes(k));
  if (body.pricingSelection !== undefined) {
    const parsed = parsePricingSelection(body.pricingSelection);
    if (parsed.error) return parsed;
    if (website && !parsed.data.children) return { error: "Total number of children is required" };
    data.pricingSelection = parsed.data;
  }
  if (!website) {
    if (body.status !== undefined) {
      if (!LEAD_STATUSES.some((s) => s.value === body.status)) return { error: "Choose a status" };
      data.status = body.status;
    }
    if (body.followUpDate !== undefined) {
      const v = String(body.followUpDate || "");
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Follow-up date must be a date" };
      data.followUpDate = v ? new Date(`${v}T00:00:00.000Z`) : null;
    }
  }
  return { data };
}

async function nextNumber(db, field, prefix, start) {
  // `number` is required; `quoteNumber` is empty until a quote is generated.
  const where = field === "quoteNumber" ? { quoteNumber: { not: null } } : {};
  const rows = await db.lead.findMany({ where, select: { [field]: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r[field] || "").replace(/\D/g, "")) || 0), start - 1);
  return `${prefix}-${max + 1}`;
}

export const nextLeadNumber = (db = prisma) => nextNumber(db, "number", "L", 1001);
export const nextQuoteNumber = (db = prisma) => nextNumber(db, "quoteNumber", "Q", 10001);

export const leadInclude = {
  activities: { include: { staff: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
  subscriberAccount: { select: { id: true, accountNumber: true, name: true } },
};

/** The price of a lead's choices with the pricing set in effect (or null). */
export async function leadQuote(lead, db = prisma) {
  const sel = lead?.pricingSelection;
  if (!sel?.children) return null;
  const set = await currentPricingSet(db);
  if (!set) return { error: "No pricing set yet. Add one under Settings > Subscription Pricing." };
  return { ...quote(set.data, { ...sel, orderDate: null, addOns: lead.addOns || [] }), pricingSet: { id: set.id, name: set.name } };
}

/**
 * Generate Quote: prices the lead with the set in effect and saves a
 * snapshot, a quote number and a link token. The quote is valid for
 * QUOTE_VALID_DAYS days.
 */
export async function generateQuote(lead, actor, db = prisma) {
  const set = await currentPricingSet(db);
  if (!set) return { error: "No pricing set yet. Add one under Settings > Subscription Pricing." };
  const sel = lead.pricingSelection || {};
  const q = quote(set.data, { ...sel, orderDate: null, addOns: lead.addOns || [] });
  if (q.error) return q;
  const today = new Date();
  const expires = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + QUOTE_VALID_DAYS));
  const counts = classroomCounts(sel);
  const snapshot = {
    pricingSet: { id: set.id, name: set.name },
    billingCycle: sel.billingCycle || "MONTHLY",
    programType: sel.programType || "CENTER",
    curriculumVersion: sel.curriculumVersion || "STANDARD",
    curriculumDetails:
      sel.programType === "HOME_DAYCARE"
        ? (set.data.homeDaycare || []).filter((p) => p.key === sel.homeDaycareProgram).map((p) => ({ label: p.label }))
        : (set.data.curriculumCenters || []).filter((g) => counts[g.key]).map((g) => ({ label: g.label, classrooms: counts[g.key] })),
    children: sel.children,
    lines: q.lines,
    discounts: q.discounts,
    monthly: q.monthly,
    periodTotal: q.periodTotal,
  };
  const quoteNumber = lead.quoteNumber || (await nextQuoteNumber(db));
  const updated = await db.lead.update({
    where: { id: lead.id },
    data: {
      quoteNumber,
      quoteToken: lead.quoteToken || crypto.randomBytes(18).toString("base64url"),
      quoteStatus: "SENT",
      quoteData: snapshot,
      quoteDate: today,
      quoteExpiresAt: expires,
      status: ["NEW", "CONTACTED", "FOLLOW_UP"].includes(lead.status) ? "QUOTE_SENT" : lead.status,
      activities: {
        create: { staffId: actor?.id || null, description: `Quote ${quoteNumber} generated: $${(q.monthly / 100).toFixed(2)} a month.` },
      },
    },
    include: leadInclude,
  });
  return { lead: updated };
}

/** Tells the Ameris team about a lead from the website (in-app notification). */
export async function notifyNewLead(lead, kind) {
  await notify(await globalAdminIds(), null, {
    title: kind === "CONTACT_FORM" ? "New message from the website" : "New quote request",
    body: `${lead.centerName} (${lead.contactName}, ${lead.email})`,
    link: `/global/leads?lead=${lead.id}`,
  });
}

/** Simple per-IP limit for the public forms (in memory, per server). */
const hits = new Map();
export function tooManyRequests(req, limit = 8, windowMs = 10 * 60 * 1000) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > limit;
}
