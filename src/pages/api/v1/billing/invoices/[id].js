import { getSession } from "@/lib/auth";
import { INVOICE_INCLUDE, billToAddress, canViewInvoice, serializeInvoice } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/billing/invoices/:id   the invoice (client mockup 09-06):
 *     admins, coaches at its center and the parent it bills.
 * PUT /api/v1/billing/invoices/:id { verified?, notes? }  (admins)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: String(req.query.id) }, include: INVOICE_INCLUDE });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  if (!(await canViewInvoice(session.user, invoice))) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    return res.status(200).json({ ...serializeInvoice(invoice), billTo: { name: invoice.parent.name || "", email: invoice.parent.email, ...(await billToAddress(invoice.parentId, invoice.centerId)) } });
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change an invoice" });
    const data = {};
    if (req.body?.verified !== undefined) {
      data.verified = req.body.verified === true;
      data.verifiedById = data.verified ? session.user.id : null;
    }
    if (req.body?.notes !== undefined) data.notes = String(req.body.notes || "").slice(0, 1000) || null;
    const updated = await prisma.billingInvoice.update({ where: { id: invoice.id }, data, include: INVOICE_INCLUDE });
    return res.status(200).json(serializeInvoice(updated));
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
