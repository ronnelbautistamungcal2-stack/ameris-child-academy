import { getSession } from "@/lib/auth";
import { billingAccess } from "@/lib/familyBilling";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/billing/parents?centerId=
 * Parent accounts with children at the center, and those children — the
 * Add Charge pickers. Admins and the center's coaches.
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

  const children = await prisma.child.findMany({
    where: { centerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parent: { select: { id: true, name: true, email: true } },
      guardians: { select: { guardian: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: [{ firstName: "asc" }],
  });
  const parents = new Map();
  for (const child of children) {
    const people = [child.parent, ...child.guardians.map((g) => g.guardian)].filter(Boolean);
    for (const p of people) {
      const entry = parents.get(p.id) || { id: p.id, name: p.name || p.email, children: [] };
      if (!entry.children.some((c) => c.id === child.id)) entry.children.push({ id: child.id, name: [child.firstName, child.lastName].filter(Boolean).join(" ") });
      parents.set(p.id, entry);
    }
  }
  return res.status(200).json([...parents.values()].sort((a, b) => a.name.localeCompare(b.name)));
}
