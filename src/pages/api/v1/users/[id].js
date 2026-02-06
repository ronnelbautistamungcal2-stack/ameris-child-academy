import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

function parseDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    // Get user by ID
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { centers: true, children: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json(user);
  }

  if (req.method === "PUT") {
    // Update user
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = req.body || {};
    const { name, role, dob, hireDate, aboutMe, pictureUrl, password } = body;
    const updateData = {};

    if ("name" in body) updateData.name = name ? String(name) : null;
    if ("role" in body && session.user.role === "ADMIN" && role)
      updateData.role = role;

    if ("dob" in body) {
      const parsed = parseDateOrNull(dob);
      if (parsed === undefined) return res.status(400).json({ error: "Invalid dob" });
      updateData.dob = parsed;
    }

    if ("hireDate" in body) {
      const parsed = parseDateOrNull(hireDate);
      if (parsed === undefined)
        return res.status(400).json({ error: "Invalid hireDate" });
      updateData.hireDate = parsed;
    }

    if ("aboutMe" in body)
      updateData.aboutMe = aboutMe ? String(aboutMe).slice(0, 5000) : null;

    if ("pictureUrl" in body)
      updateData.pictureUrl = pictureUrl ? String(pictureUrl).slice(0, 2000) : null;

    if ("password" in body && password) {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can reset passwords" });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      updateData.password = await bcrypt.hash(String(password), 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { centers: true },
    });

    return res.status(200).json(user);
  }

  if (req.method === "DELETE") {
    // Delete user
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete users" });
    }

    if (session.user.id === id) {
      return res.status(400).json({ error: "You cannot delete your own user" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.teacherClass.deleteMany({ where: { teacherId: id } });
        await tx.centerUser.deleteMany({ where: { userId: id } });
        await tx.activityLog.updateMany({
          where: { recordedById: id },
          data: { recordedById: null },
        });
        await tx.child.updateMany({
          where: { parentId: id },
          data: { parentId: null },
        });

        await tx.user.delete({ where: { id } });
      });
    } catch (e) {
      // Commonly: foreign key constraint / record not found
      return res
        .status(409)
        .json({ error: e?.message || "Unable to delete user" });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
