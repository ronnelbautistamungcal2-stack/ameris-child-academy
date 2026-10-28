import { getSession } from "@/lib/auth";
import { INVOICE_INCLUDE, serializeInvoice } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/billing/ledger
 * The signed-in parent's billing (client mockup 09-01) in the shape the
 * Billing page reads: statements (one per invoice), payments and scheduled
 * payments (none until AutoPay exists).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const invoices = (await prisma.billingInvoice.findMany({ where: { parentId: session.user.id }, include: INVOICE_INCLUDE, orderBy: { period: "desc" } }))
    .map(serializeInvoice)
    .filter((i) => i.charges.length);

  const statements = invoices.map((inv) => {
    const names = [...new Set(inv.charges.map((c) => c.childName).filter(Boolean))];
    const descriptions = [...new Set(inv.charges.map((c) => c.description))];
    return {
      id: inv.id,
      invoiceId: inv.id,
      number: inv.number,
      date: inv.invoiceDate,
      dueDate: inv.dueDate,
      description: descriptions.length === 1 ? descriptions[0] : `${descriptions[0]} + ${descriptions.length - 1} more`,
      appliesTo: names.length ? names : "ALL",
      amountCents: inv.totalCents,
      balanceCents: inv.balanceCents,
      status: inv.status === "PAID" ? "Paid" : "Open",
      invoiceStatus: inv.status,
    };
  });
  const payments = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({
      id: p.id,
      invoiceId: inv.id,
      date: p.paidAt,
      description: `Payment — ${inv.number}${p.method ? ` (${p.method})` : ""}`,
      appliesTo: "ALL",
      amountCents: p.amountCents,
      status: "Paid",
    })),
  );
  return res.status(200).json({ statements, payments, scheduledPayments: [] });
}
