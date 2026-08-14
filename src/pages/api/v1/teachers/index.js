import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EMPLOYEE_ROLES } from "@/lib/roles";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage staff" });
  }

  if (req.method === "GET") {
    const staff = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: EMPLOYEE_ROLES } },
          { roles: { hasSome: EMPLOYEE_ROLES } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        centers: { include: { center: true } },
        teacherClasses: { include: { classRoom: true } },
        coachTeamMembers: { include: { staff: { select: { id: true, name: true, email: true } } } },
      },
    });
    return res.status(200).json(staff);
  }

  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
