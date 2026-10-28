import { getSession } from "@/lib/auth";
import { billingAccess, dbDate, invoiceFor, parseAmountCents, periodOf } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * PUT    /api/v1/billing/charges/:id { date?, description?, amount? }
 * DELETE /api/v1/billing/charges/:id
 * Admins and the center's coaches. A new date in another month moves the
 * charge to that month's invoice.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const charge = await prisma.billingCharge.findUnique({ where: { id: String(req.query.id) }, include: { invoice: { select: { parentId: true } } } });
  if (!charge) return res.status(404).json({ error: "Charge not found" });
  const access = await billingAccess(session.user, charge.centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "PUT") {
    const data = {};
    const body = req.body || {};
    if (body.description !== undefined) {
      data.description = String(body.description).trim().slice(0, 200);
      if (!data.description) return res.status(400).json({ error: "Enter a description" });
    }
    if (body.amount !== undefined) {
      data.amountCents = parseAmountCents(body.amount);
      if (!data.amountCents) return res.status(400).json({ error: "Enter an amount" });
    }
    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) return res.status(400).json({ error: "Choose the date" });
      data.date = dbDate(body.date);
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (data.date) {
        const invoice = await invoiceFor(tx, { parentId: charge.invoice.parentId, centerId: charge.centerId, period: periodOf(body.date) });
        data.invoiceId = invoice.id;
      }
      return tx.billingCharge.update({ where: { id: charge.id }, data });
    });
    return res.status(200).json({ id: updated.id });
  }

  if (req.method === "DELETE") {
    await prisma.billingCharge.delete({ where: { id: charge.id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end();
}
