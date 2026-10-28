import { getSession } from "@/lib/auth";
import { keyOf, parseRequirement, requirementStatus } from "@/lib/complianceRequirements";
import prisma from "@/lib/prisma";

export function serializeRequirement(r) {
  const status = requirementStatus(r);
  return {
    ...r,
    nextDue: keyOf(new Date(r.nextDue)),
    status,
    progress: { done: status === "COMPLETED" ? 1 : 0, total: 1 },
  };
}

/**
 * GET  /api/v1/compliance/requirements[?centerId=]  Compliance Alerts (admins)
 * POST /api/v1/compliance/requirements { centerId?, ...requirement }
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const centerId = req.query.centerId ? String(req.query.centerId) : null;
    const rows = await prisma.complianceRequirement.findMany({
      where: centerId ? { OR: [{ centerId }, { centerId: null }] } : {},
      orderBy: [{ category: "asc" }, { nextDue: "asc" }],
    });
    return res.status(200).json(rows.map(serializeRequirement));
  }

  if (req.method === "POST") {
    const parsed = parseRequirement(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const created = await prisma.complianceRequirement.create({
      data: { ...parsed.data, centerId: req.body?.centerId ? String(req.body.centerId) : null, createdById: session.user.id },
    });
    return res.status(201).json(serializeRequirement(created));
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
