// Family billing (client mockups 09-01..09; server only). Charges land on the
// parent account's invoice for the charge's month (created on demand, dated the
// 1st, due on DUE_DAY); payments settle it. Monthly tuition is entered as a
// charge — the client chose not to automate it (2026-10-14).

import { hasAccessToCenter } from "@/lib/auth";
import { buildParentLinkedChildWhere, isChildLinkedToParent } from "@/lib/child-parent-links";
import prisma from "@/lib/prisma";
import { emitNotification } from "@/lib/socket";

export const DUE_DAY = 15;
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");

export const dbDate = (key) => new Date(`${String(key).slice(0, 10)}T00:00:00.000Z`);
export const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
export const periodOf = (key) => String(key).slice(0, 7);

/** Admins see every center; coaches the centers they belong to. */
export async function billingAccess(user, centerId) {
  if (user.role === "ADMIN") return { ok: true, canVerify: true };
  if (user.role === "COACH" && centerId && (await hasAccessToCenter(user.id, centerId))) return { ok: true, canVerify: false };
  return { ok: false, status: 403, error: "Forbidden" };
}

/** The parent's invoice for a month at a center, created if needed. */
export async function invoiceFor(tx, { parentId, centerId, period }) {
  const [y, m] = period.split("-").map(Number);
  return tx.billingInvoice.upsert({
    where: { parentId_centerId_period: { parentId, centerId, period } },
    update: {},
    create: {
      parentId,
      centerId,
      period,
      invoiceDate: dbDate(`${period}-01`),
      dueDate: dbDate(`${y}-${pad(m)}-${pad(DUE_DAY)}`),
    },
  });
}

/**
 * Totals and status: PAID once payments cover the charges, OVERDUE after
 * the due date, DUE_SOON within 7 days of it, otherwise OPEN.
 */
export function invoiceSummary(invoice, today = new Date()) {
  const totalCents = (invoice.charges || []).reduce((s, c) => s + c.amountCents, 0);
  const paidCents = (invoice.payments || []).reduce((s, p) => s + p.amountCents, 0);
  const balanceCents = Math.max(0, totalCents - paidCents);
  const startOfToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const due = new Date(invoice.dueDate);
  let status = "OPEN";
  if (totalCents > 0 && balanceCents === 0) status = "PAID";
  else if (balanceCents > 0 && due < startOfToday) status = "OVERDUE";
  else if (balanceCents > 0 && due.getTime() - startOfToday.getTime() <= 7 * DAY) status = "DUE_SOON";
  return { totalCents, paidCents, balanceCents, status };
}

export const INVOICE_INCLUDE = {
  center: { select: { id: true, name: true, address: true, city: true, state: true, zip: true, phone: true, contactEmail: true } },
  parent: { select: { id: true, name: true, email: true } },
  charges: { include: { child: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
  payments: { orderBy: { paidAt: "asc" } },
};

const childName = (c) => (c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : "");

export function serializeInvoice(invoice) {
  return {
    id: invoice.id,
    number: `INV-${10000 + invoice.number}`,
    period: invoice.period,
    invoiceDate: dateKey(invoice.invoiceDate),
    dueDate: dateKey(invoice.dueDate),
    verified: invoice.verified,
    notes: invoice.notes || "",
    center: invoice.center,
    parent: invoice.parent,
    charges: invoice.charges.map((c) => ({
      id: c.id,
      date: dateKey(c.date),
      childId: c.childId,
      childName: childName(c.child),
      description: c.description,
      amountCents: c.amountCents,
    })),
    payments: invoice.payments.map((p) => ({ id: p.id, amountCents: p.amountCents, paidAt: p.paidAt, method: p.method || "", note: p.note || "" })),
    ...invoiceSummary(invoice),
  };
}

/** Who may open an invoice: admins, coaches at its center, the parent it bills. */
export async function canViewInvoice(user, invoice) {
  if (user.role === "ADMIN") return true;
  if (invoice.parentId === user.id) return true;
  return user.role === "COACH" && hasAccessToCenter(user.id, invoice.centerId);
}

/** The parent's billing address from their children's profiles. */
export async function billToAddress(parentId, centerId) {
  const children = await prisma.child.findMany({
    where: buildParentLinkedChildWhere(parentId, { centerId }),
    select: { parentContacts: true, parentId: true, guardians: { select: { guardianId: true } } },
  });
  for (const child of children) {
    const contact = (Array.isArray(child.parentContacts) ? child.parentContacts : []).find((c) => c?.address || c?.phone);
    if (contact) return { address: contact.address || "", phone: contact.phone || "" };
  }
  return { address: "", phone: "" };
}

export function parseAmountCents(value) {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100);
}

/**
 * Add Charge: rows of { childId, description, amount } for one parent on one
 * date. Each child must be the parent's and at the center. Tells the parent.
 */
export async function addCharges({ user, centerId, parentId, date, rows }) {
  const parent = await prisma.user.findUnique({ where: { id: parentId }, select: { id: true, name: true } });
  if (!parent) return { status: 400, error: "Choose the parent" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return { status: 400, error: "Choose the date" };
  if (!Array.isArray(rows) || !rows.length) return { status: 400, error: "Add at least one charge" };
  const childIds = [...new Set(rows.map((r) => String(r?.childId || "")).filter(Boolean))];
  const children = await prisma.child.findMany({
    where: { id: { in: childIds }, centerId },
    select: { id: true, centerId: true, firstName: true, parentId: true, guardians: { select: { guardianId: true } } },
  });
  const lines = [];
  for (const row of rows) {
    const child = children.find((c) => c.id === row?.childId);
    if (row?.childId && (!child || !isChildLinkedToParent(child, parentId))) return { status: 400, error: "Each child must belong to that parent at this center" };
    const description = String(row?.description || "").trim().slice(0, 200);
    if (!description) return { status: 400, error: "Enter a description for each charge" };
    const amountCents = parseAmountCents(row?.amount);
    if (!amountCents) return { status: 400, error: "Enter an amount for each charge" };
    lines.push({ childId: child?.id || null, description, amountCents });
  }
  const created = await prisma.$transaction(async (tx) => {
    const invoice = await invoiceFor(tx, { parentId, centerId, period: periodOf(date) });
    const out = [];
    for (const line of lines) {
      out.push(await tx.billingCharge.create({ data: { ...line, invoiceId: invoice.id, centerId, date: dbDate(date), createdById: user.id } }));
    }
    return out;
  });
  const total = lines.reduce((s, l) => s + l.amountCents, 0);
  const notification = await prisma.notification.create({
    data: {
      recipientId: parentId,
      type: "SYSTEM",
      title: "New charge on your account",
      body: `${lines.map((l) => l.description).join(", ")} — $${(total / 100).toFixed(2)}`,
      link: "/parent/billing",
      metadata: { chargeIds: created.map((c) => c.id) },
    },
  });
  emitNotification(parentId, notification);
  return { charges: created };
}

/** Parent Fees rows: the charge with its child, classroom and parent. */
export function serializeCharge(c) {
  return {
    id: c.id,
    date: dateKey(c.date),
    description: c.description,
    amountCents: c.amountCents,
    invoiceId: c.invoiceId,
    child: c.child ? { id: c.child.id, name: childName(c.child), birthDate: c.child.birthDate, photoUrl: c.child.photoUrl, classroom: c.child.classRoom?.name || "" } : null,
    parent: c.invoice?.parent ? { id: c.invoice.parent.id, name: c.invoice.parent.name || c.invoice.parent.email } : null,
  };
}
