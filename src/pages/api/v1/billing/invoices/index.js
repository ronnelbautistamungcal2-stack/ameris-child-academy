import { getSession } from "@/lib/auth";
import { INVOICE_INCLUDE, billingAccess, serializeInvoice } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/billing/invoices?centerId=&month=YYYY-MM[&status=&classRoomId=&q=]
 * Admin Billing (client mockup 09-05): each parent account with the month's
 * invoices, balance and status, plus the summary tiles. Admins and the
 * center's coaches.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  const access = await billingAccess(session.user, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? req.query.month : null;

  const invoices = await prisma.billingInvoice.findMany({
    where: { centerId, ...(month ? { period: { lte: month } } : {}) },
    include: INVOICE_INCLUDE,
    orderBy: [{ period: "desc" }],
  });
  const rows = invoices.map(serializeInvoice).filter((i) => i.charges.length);

  // Children on each parent's invoices, for the Clients column and the room filter.
  const childIds = [...new Set(rows.flatMap((i) => i.charges.map((c) => c.childId).filter(Boolean)))];
  const children = await prisma.child.findMany({ where: { id: { in: childIds } }, select: { id: true, firstName: true, classRoomId: true } });
  const byId = Object.fromEntries(children.map((c) => [c.id, c]));

  const parents = new Map();
  for (const inv of rows) {
    const entry = parents.get(inv.parent.id) || { parent: inv.parent, invoices: [], childIds: new Set() };
    entry.invoices.push(inv);
    inv.charges.forEach((c) => c.childId && entry.childIds.add(c.childId));
    parents.set(inv.parent.id, entry);
  }
  const rank = { OVERDUE: 3, DUE_SOON: 2, OPEN: 1, PAID: 0 };
  let list = [...parents.values()].map((p) => {
    const monthInvoices = month ? p.invoices.filter((i) => i.period === month) : p.invoices;
    const owing = p.invoices.filter((i) => i.balanceCents > 0);
    const worst = owing.reduce((s, i) => (rank[i.status] > rank[s] ? i.status : s), "PAID");
    return {
      parent: { id: p.parent.id, name: p.parent.name || p.parent.email, email: p.parent.email },
      clients: [...p.childIds].map((id) => byId[id]?.firstName).filter(Boolean),
      classRoomIds: [...new Set([...p.childIds].map((id) => byId[id]?.classRoomId).filter(Boolean))],
      balanceCents: owing.reduce((s, i) => s + i.balanceCents, 0),
      status: owing.length ? worst : "PAID",
      invoices: monthInvoices.length ? monthInvoices : p.invoices.slice(0, 3),
    };
  });

  const paidThisMonth = month ? list.filter((p) => p.invoices.some((i) => i.period === month && i.status === "PAID")).length : 0;
  const tiles = {
    totalClients: list.length,
    paidThisMonth,
    dueSoon: list.filter((p) => p.status === "DUE_SOON").length,
    overdue: list.filter((p) => p.status === "OVERDUE").length,
  };

  const q = String(req.query.q || "").trim().toLowerCase();
  if (q) list = list.filter((p) => `${p.parent.name} ${p.clients.join(" ")}`.toLowerCase().includes(q));
  if (req.query.status) list = list.filter((p) => p.status === req.query.status);
  if (req.query.classRoomId) list = list.filter((p) => p.classRoomIds.includes(String(req.query.classRoomId)));
  list.sort((a, b) => a.parent.name.localeCompare(b.parent.name));

  return res.status(200).json({ tiles, parents: list, canVerify: access.canVerify });
}
