import { getSession } from "@/lib/auth";
import { INVOICE_INCLUDE, parseAmountCents, serializeInvoice } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * POST   /api/v1/billing/invoices/:id/payments { amount, paidAt?, method?, note? }
 * DELETE /api/v1/billing/invoices/:id/payments?paymentId=
 * Admins record (or remove) a payment received for the invoice.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can record payments" });
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: String(req.query.id) } });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  if (req.method === "POST") {
    const amountCents = parseAmountCents(req.body?.amount);
    if (!amountCents) return res.status(400).json({ error: "Enter the amount paid" });
    const paidAt = req.body?.paidAt ? new Date(req.body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) return res.status(400).json({ error: "The payment date is invalid" });
    await prisma.billingPayment.create({
      data: {
        invoiceId: invoice.id,
        amountCents,
        paidAt,
        method: req.body?.method ? String(req.body.method).slice(0, 60) : null,
        note: req.body?.note ? String(req.body.note).slice(0, 300) : null,
        recordedById: session.user.id,
      },
    });
  } else if (req.method === "DELETE") {
    await prisma.billingPayment.deleteMany({ where: { id: String(req.query.paymentId || ""), invoiceId: invoice.id } });
  } else {
    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end();
  }
  const updated = await prisma.billingInvoice.findUnique({ where: { id: invoice.id }, include: INVOICE_INCLUDE });
  return res.status(200).json(serializeInvoice(updated));
}
