import { accessibleCenterIds, getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageIpp } from "@/lib/ippAccess";
import { hasAnyRole } from "@/lib/roles";

/** GET /api/v1/ipp/children — the children a plan can be created for. */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!canManageIpp(session.user)) return res.status(403).json({ error: "Forbidden" });
    const ids = hasAnyRole(session.user, ["ADMIN"]) ? null : (await accessibleCenterIds(session.user.id)) || [];
    const children = await prisma.child.findMany({
      where: ids ? { centerId: { in: ids } } : {},
      select: { id: true, firstName: true, lastName: true, classRoom: { select: { name: true } }, center: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return res.status(200).json(
      children.map((c) => ({
        id: c.id,
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        classroom: c.classRoom?.name || "",
        center: c.center?.name || "",
      })),
    );
  } catch (e) {
    console.error("ipp children error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
