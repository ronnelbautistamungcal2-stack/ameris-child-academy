import { getSession } from "@/lib/auth";
import { addCharges, billingAccess, dbDate, serializeCharge } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

const CHARGE_INCLUDE = {
  child: { select: { id: true, firstName: true, lastName: true, birthDate: true, photoUrl: true, classRoom: { select: { name: true } } } },
  invoice: { select: { parent: { select: { id: true, name: true, email: true } } } },
};

/**
 * GET  /api/v1/billing/charges?centerId=[&from=&to=&classRoomId=&q=]
 *      Parent Fees list (client mockup 09-03). Admins and the center's coaches.
 * POST /api/v1/billing/charges { centerId, parentId, date, rows: [{ childId, description, amount }] }
 *      Add Charge (09-04): goes on the parent's invoice for that month and
 *      the parent is notified.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const centerId = String(req.query.centerId || req.body?.centerId || "");
  if (!centerId) return res.status(400).json({ error: "centerId is required" });
  const access = await billingAccess(session.user, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.method === "GET") {
    const { from, to, classRoomId, q } = req.query;
    const date = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(from || ""))) date.gte = dbDate(from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) date.lte = dbDate(to);
    const search = String(q || "").trim();
    const charges = await prisma.billingCharge.findMany({
      where: {
        centerId,
        ...(Object.keys(date).length ? { date } : {}),
        ...(classRoomId ? { child: { classRoomId: String(classRoomId) } } : {}),
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: "insensitive" } },
                { child: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } },
                { invoice: { parent: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: CHARGE_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    return res.status(200).json(charges.map(serializeCharge));
  }

  if (req.method === "POST") {
    const result = await addCharges({ user: session.user, centerId, parentId: String(req.body?.parentId || ""), date: req.body?.date, rows: req.body?.rows });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(201).json({ count: result.charges.length });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
