import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole, userRoles } from "@/lib/roles";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage staff" });
  }

  const { id } = req.query;

  const staffMember = await prisma.user.findUnique({ where: { id } });
  if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
  const roles = userRoles(staffMember);
  if (!roles.some(isEmployeeRole)) {
    return res.status(400).json({ error: "User is not a staff member" });
  }
  const isTeacher = roles.includes("TEACHER");
  const assignmentRole = roles.find(isEmployeeRole);

  if (req.method === "PUT") {
    const { centerIds, classIds } = req.body || {};

    const centers = Array.isArray(centerIds) ? centerIds.filter(Boolean) : null;
    const classes = isTeacher && Array.isArray(classIds) ? classIds.filter(Boolean) : null;

    await prisma.$transaction(async (tx) => {
      if (centers) {
        const existing = await tx.centerUser.findMany({
          where: { userId: id },
          select: { id: true, centerId: true, role: true },
        });

        const ownCenterRows = existing.filter((r) => r.role === assignmentRole);
        const ownCenterIds = new Set(ownCenterRows.map((r) => r.centerId));
        const desired = new Set(centers);

        const toDelete = ownCenterRows
          .filter((r) => !desired.has(r.centerId))
          .map((r) => r.id);

        if (toDelete.length) {
          await tx.centerUser.deleteMany({ where: { id: { in: toDelete } } });
        }

        const toCreate = centers.filter((cId) => !ownCenterIds.has(cId));
        if (toCreate.length) {
          await tx.centerUser.createMany({
            data: toCreate.map((cId) => ({ userId: id, centerId: cId, role: assignmentRole })),
            skipDuplicates: true,
          });
        }
      }

      if (classes) {
        const existing = await tx.teacherClass.findMany({
          where: { teacherId: id },
          select: { id: true, classId: true },
        });
        const existingIds = new Set(existing.map((r) => r.classId));
        const desired = new Set(classes);

        const toDelete = existing.filter((r) => !desired.has(r.classId)).map((r) => r.id);
        if (toDelete.length) {
          await tx.teacherClass.deleteMany({ where: { id: { in: toDelete } } });
        }

        const toCreate = classes.filter((cId) => !existingIds.has(cId));
        if (toCreate.length) {
          await tx.teacherClass.createMany({
            data: toCreate.map((cId) => ({ teacherId: id, classId: cId })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id },
      include: {
        centers: { include: { center: true } },
        teacherClasses: { include: { classRoom: true } },
      },
    });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", ["PUT"]);
  res.status(405).end();
}
