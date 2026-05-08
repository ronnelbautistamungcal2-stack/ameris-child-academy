import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hasEmployeeRole, normalizeRoles, primaryRoleFromRoles, userRoles } from "@/lib/roles";

function parseDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  if (!user) return user;
  const { password, ...safeUser } = user;
  safeUser.roles = userRoles(safeUser);
  return safeUser;
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

    return res.status(200).json(sanitizeUser(user));
  }

  if (req.method === "PUT") {
    // Update user
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = req.body || {};
    const { email, name, role, roles, dob, hireDate, aboutMe, pictureUrl, password } = body;
    const updateData = {};
    const assignedRoles = "roles" in body || "role" in body
      ? normalizeRoles(roles || role, role || "PARENT")
      : null;
    const isEmployee = assignedRoles ? hasEmployeeRole(assignedRoles) : true;

    if ("email" in body) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ error: "Email is required" });
      }
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: "Email already exists" });
      }
      updateData.email = normalizedEmail;
    }

    if ("name" in body) updateData.name = name ? String(name) : null;
    if (assignedRoles && session.user.role === "ADMIN") {
      updateData.roles = assignedRoles;
      updateData.role = primaryRoleFromRoles(assignedRoles, "PARENT");
      if (!hasEmployeeRole(assignedRoles)) {
        updateData.dob = null;
        updateData.hireDate = null;
        updateData.aboutMe = null;
        updateData.pictureUrl = null;
      }
    }

    if ("dob" in body) {
      const parsed = parseDateOrNull(dob);
      if (parsed === undefined) return res.status(400).json({ error: "Invalid dob" });
      updateData.dob = isEmployee ? parsed : null;
    }

    if ("hireDate" in body) {
      const parsed = parseDateOrNull(hireDate);
      if (parsed === undefined)
        return res.status(400).json({ error: "Invalid hireDate" });
      updateData.hireDate = isEmployee ? parsed : null;
    }

    if ("aboutMe" in body)
      updateData.aboutMe = isEmployee && aboutMe ? String(aboutMe).slice(0, 5000) : null;

    if ("pictureUrl" in body)
      updateData.pictureUrl = isEmployee && pictureUrl ? String(pictureUrl).slice(0, 2000) : null;

    if ("password" in body && password) {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can reset passwords" });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      updateData.password = await bcrypt.hash(String(password), 10);
      updateData.mustChangePassword = session.user.id !== id;
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id },
        data: updateData,
        include: { centers: true },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return res.status(409).json({ error: "Email already exists" });
      }
      throw error;
    }

    return res.status(200).json(sanitizeUser(user));
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
        await tx.teacherRecord.deleteMany({ where: { teacherId: id } });
        await tx.teacherRecord.updateMany({
          where: { createdById: id },
          data: { createdById: null },
        });
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
