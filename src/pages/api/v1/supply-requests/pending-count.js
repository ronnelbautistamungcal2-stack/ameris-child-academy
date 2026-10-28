import { accessibleCenterIds, getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/supply-requests/pending-count
 * Pending supply requests at the centers an admin or coach reviews, for the
 * red count next to Supply Lists in the navigation.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!["ADMIN", "COACH"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerIds = session.user.role === "ADMIN" ? null : (await accessibleCenterIds(session.user.id)) || [];
  const count = await prisma.supplyRequest.count({
    where: { status: "PENDING", ...(centerIds ? { centerId: { in: centerIds } } : {}) },
  });
  return res.status(200).json({ count });
}
