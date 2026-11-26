import { accessibleCenterIds, adminCanReachUser, getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { pinStatusOf } from "@/lib/kioskPins";
import { normalizeMiddleInitial } from "@/lib/personNames";
import {
  hasEmployeeRole,
  normalizeRoles,
  normalizeStaffDepartment,
  primaryRoleFromRoles,
  userRoles,
  centerAssignableRoles,
  GLOBAL_ADMIN_ROLE,
} from "@/lib/roles";
import { isGlobalAdmin } from "@/lib/subscriberAccounts";

function parseDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseWeeklySchedules(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    const days = Array.isArray(raw?.daysOfWeek)
      ? [...new Set(raw.daysOfWeek.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
      : [];
    const startTime = String(raw?.startTime || "");
    const endTime = String(raw?.endTime || "");
    if (!days.length || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) continue;
    out.push({ daysOfWeek: days, startTime, endTime });
  }
  return out;
}

function sanitizeUser(user) {
  if (!user) return user;
  const { password, kioskCredential, ...safeUser } = user;
  safeUser.roles = userRoles(safeUser);
  safeUser.pinStatus = pinStatusOf(kioskCredential);
  return safeUser;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  // Admins only reach people in their own subscriber account.
  if (session.user.role === "ADMIN" && !(await adminCanReachUser(session.user.id, id))) {
    return res.status(404).json({ error: "User not found" });
  }

  if (req.method === "GET") {
    // Get user by ID
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { centers: true, children: true, weeklySchedules: true, kioskCredential: true },
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
    const {
      email,
      name,
      role,
      roles,
      dob,
      hireDate,
      aboutMe,
      staffDepartment,
      pictureUrl,
      password,
      weeklySchedules,
      middleInitial,
      disabled,
    } = body;
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
    if ("middleInitial" in body) {
      const normalizedMiddleInitial = normalizeMiddleInitial(middleInitial);
      if (!normalizedMiddleInitial) {
        return res.status(400).json({ error: "Middle initial is required" });
      }
      updateData.middleInitial = normalizedMiddleInitial;
    }
    if ("disabled" in body) {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can enable or disable users" });
      }
      if (session.user.id === id && disabled) {
        return res.status(400).json({ error: "You cannot disable your own account" });
      }
      updateData.disabled = Boolean(disabled);
    }
    if (assignedRoles && session.user.role === "ADMIN") {
      // Only a global admin grants or removes GLOBAL_ADMIN; center admins keep
      // whatever the person already had.
      if (!isGlobalAdmin(session.user)) {
        const current = await prisma.user.findUnique({ where: { id }, select: { roles: true } });
        const kept = (current?.roles || []).includes(GLOBAL_ADMIN_ROLE) ? [GLOBAL_ADMIN_ROLE] : [];
        assignedRoles.splice(0, assignedRoles.length, ...centerAssignableRoles(assignedRoles), ...kept);
        if (!assignedRoles.length) assignedRoles.push("PARENT");
      }
      updateData.roles = assignedRoles;
      updateData.role = primaryRoleFromRoles(centerAssignableRoles(assignedRoles), "PARENT");
      if (!hasEmployeeRole(assignedRoles)) {
        updateData.dob = null;
        updateData.hireDate = null;
        updateData.aboutMe = null;
        updateData.staffDepartment = null;
        updateData.pictureUrl = null;
        updateData.weeklySchedules = { deleteMany: {} };
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

    if ("staffDepartment" in body)
      updateData.staffDepartment = isEmployee
        ? normalizeStaffDepartment(staffDepartment) || null
        : null;

    if ("pictureUrl" in body)
      updateData.pictureUrl = isEmployee && pictureUrl ? String(pictureUrl).slice(0, 2000) : null;

    if ("weeklySchedules" in body && !updateData.weeklySchedules) {
      updateData.weeklySchedules = {
        deleteMany: {},
        create: isEmployee ? parseWeeklySchedules(weeklySchedules) : [],
      };
    }

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

    // centerIds: the centers the user is assigned to (client sheet 10-29 (11),
    // row 48). An admin changes only the centers they can reach; the user's
    // other centers stay.
    let centerChange = null;
    if ("centerIds" in body) {
      if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change centers" });
      const wanted = [...new Set((Array.isArray(body.centerIds) ? body.centerIds : []).map(String))];
      const ids = await accessibleCenterIds(session.user.id);
      // null: an admin with no account limit (legacy data).
      const reachable = new Set(ids === null ? (await prisma.center.findMany({ select: { id: true } })).map((c) => c.id) : ids);
      if (wanted.some((c) => !reachable.has(c))) return res.status(400).json({ error: "Invalid centerId" });
      const current = await prisma.centerUser.findMany({ where: { userId: id }, select: { centerId: true } });
      const have = new Set(current.map((c) => c.centerId));
      centerChange = {
        add: wanted.filter((c) => !have.has(c)),
        remove: [...have].filter((c) => reachable.has(c) && !wanted.includes(c)),
      };
    }

    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        if (centerChange) {
          const roleForCenter = (assignedRoles && assignedRoles[0]) || (await tx.user.findUnique({ where: { id }, select: { role: true } }))?.role || "PARENT";
          if (centerChange.remove.length) await tx.centerUser.deleteMany({ where: { userId: id, centerId: { in: centerChange.remove } } });
          if (centerChange.add.length) {
            await tx.centerUser.createMany({ data: centerChange.add.map((centerId) => ({ userId: id, centerId, role: roleForCenter })), skipDuplicates: true });
          }
        }
        return tx.user.update({
          where: { id },
          data: updateData,
          include: { centers: true, weeklySchedules: true, kioskCredential: true },
        });
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
        await tx.timeSheetAudit.deleteMany({ where: { kind: "staff", userId: id } });
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
