import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { centerId, children } = req.body || {};
  if (!centerId || !Array.isArray(children) || !children.length) {
    return res.status(400).json({ error: "centerId and children array are required" });
  }

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) return res.status(404).json({ error: "Center not found" });

  const created = [];
  const errors = [];

  for (let i = 0; i < children.length; i++) {
    const row = children[i];
    try {
      if (!row.firstName || !row.firstName.trim()) {
        errors.push({ index: i, error: "firstName is required" });
        continue;
      }

      let parentId = null;
      if (row.parentEmail) {
        const parent = await prisma.user.findUnique({
          where: { email: row.parentEmail.trim().toLowerCase() },
        });
        if (parent && parent.role === "PARENT") parentId = parent.id;
      }

      let classRoomId = null;
      if (row.classRoomId) {
        const cls = await prisma.classRoom.findUnique({ where: { id: row.classRoomId } });
        if (cls && cls.centerId === centerId) classRoomId = cls.id;
      }

      const child = await prisma.child.create({
        data: {
          firstName: row.firstName.trim(),
          lastName: row.lastName?.trim() || null,
          birthDate: row.birthDate ? new Date(row.birthDate) : null,
          centerId,
          classRoomId,
          parentId,
          emergencyContact: row.emergencyContact?.trim() || null,
          allergies: row.allergies?.trim() || null,
        },
      });
      created.push(child);
    } catch (err) {
      errors.push({ index: i, error: err.message || "Failed to create child" });
    }
  }

  return res.status(201).json({ created: created.length, errors, children: created });
}
