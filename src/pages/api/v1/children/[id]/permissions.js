import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherCanAccessClass } from "@/lib/teacherScope";

const VALID_TYPES = [
  "PHOTO_RELEASE",
  "FIELD_TRIP",
  "MEDICAL_TREATMENT",
  "TRANSPORTATION",
  "SUNSCREEN_APPLICATION",
  "WATER_ACTIVITIES",
  "OTHER",
];

const VALID_STATUSES = ["PENDING", "GRANTED", "DENIED", "REVOKED"];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Child id is required" });

  const child = await prisma.child.findUnique({
    where: { id },
    select: { id: true, parentId: true, classRoomId: true, centerId: true },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });

  // Authorization
  if (session.user.role === "PARENT") {
    if (child.parentId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else if (session.user.role === "TEACHER") {
    if (child.classRoomId) {
      const hasAccess = await teacherCanAccessClass(session.user.id, child.classRoomId);
      if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
    }
  } else if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const permissions = await prisma.childPermission.findMany({
      where: { childId: id },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(permissions);
  }

  if (req.method === "POST") {
    // Only PARENT (own child) and ADMIN can set permissions
    if (!["ADMIN", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Only admins and parents can manage permissions" });
    }

    const { permissionType, status, notes, expirationDate } = req.body;

    if (!permissionType || !VALID_TYPES.includes(permissionType)) {
      return res.status(400).json({ error: "Valid permissionType is required" });
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Valid status is required (GRANTED, DENIED, etc.)" });
    }

    // Parents can only GRANT or DENY
    if (session.user.role === "PARENT" && !["GRANTED", "DENIED"].includes(status)) {
      return res.status(403).json({ error: "Parents can only grant or deny permissions" });
    }

    const permission = await prisma.childPermission.upsert({
      where: { childId_permissionType: { childId: id, permissionType } },
      update: {
        status,
        notes: notes || null,
        grantedById: session.user.id,
        effectiveDate: new Date(),
        expirationDate: expirationDate ? new Date(expirationDate) : null,
      },
      create: {
        childId: id,
        permissionType,
        status,
        notes: notes || null,
        grantedById: session.user.id,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(permission);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
