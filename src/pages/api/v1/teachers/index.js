import { accessibleCenterIds, getSession } from "@/lib/auth";
import { coachTeamUserIds, onCoachTeam } from "@/lib/coachTeam";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES, isManagerRole } from "@/lib/roles";
import { EMPLOYED_WHERE } from "@/lib/employment";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isManagerRole(session.user.role)) {
    return res.status(403).json({ error: "Only admins and coaches can manage staff" });
  }

  if (req.method === "GET") {
    const centerScope =
      await accessibleCenterIds(session.user.id);

    const staff = await prisma.user.findMany({
      where: {
        AND: [
          // Staff Positions lists only people who are currently employed.
          EMPLOYED_WHERE,
          {
            OR: [
              { role: { in: EMPLOYEE_ROLES } },
              { roles: { hasSome: EMPLOYEE_ROLES } },
            ],
          },
          ...(centerScope
            ? [{ centers: { some: { centerId: { in: centerScope } } } }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        centers: { include: { center: true } },
        teacherClasses: { include: { classRoom: true } },
        coachTeamMembers: { include: { staff: { select: { id: true, name: true, email: true } } } },
      },
    });
    return res.status(200).json(onCoachTeam(staff, await coachTeamUserIds(prisma, session)));
  }

  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
