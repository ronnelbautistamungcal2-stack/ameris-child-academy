import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { childStatus, levelForStatus } from "@/lib/sop";
import { SOP_ROLES, sopChildScope } from "@/lib/sopServer";

/**
 * GET /api/v1/sop/tracking?centerId=&classRoomId=
 * Progression Tracking's Children list: each child the user can see with
 * their number of active goals, last update and status.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    const user = session.user;
    if (!hasAnyRole(user, SOP_ROLES)) return res.status(403).json({ error: "Forbidden" });
    const centerId = req.query.centerId ? String(req.query.centerId) : undefined;
    const scope = await sopChildScope(user, centerId);
    if (!scope) return res.status(403).json({ error: "Forbidden" });

    const children = await prisma.child.findMany({
      where: { AND: [scope, req.query.classRoomId ? { classRoomId: String(req.query.classRoomId) } : {}] },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        photoUrl: true,
        classRoom: { select: { name: true } },
        progress: {
          where: { lesson: { isStep: true } },
          select: {
            status: true,
            active: true,
            updatedAt: true,
            lesson: { select: { ageYears: true, ageMonths: true, maxAgeYears: true, maxAgeMonths: true } },
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return res.status(200).json(
      children.map((c) => {
        const active = c.progress.filter((p) => p.active);
        const last = c.progress.reduce((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null);
        return {
          id: c.id,
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          photoUrl: c.photoUrl,
          classroom: c.classRoom?.name || "",
          activeGoals: active.length,
          lastUpdate: last,
          status: active.length
            ? childStatus(active.map((p) => ({ step: p.lesson, level: levelForStatus(p.status) })), c.birthDate)
            : null,
        };
      }),
    );
  } catch (e) {
    console.error("sop tracking error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
