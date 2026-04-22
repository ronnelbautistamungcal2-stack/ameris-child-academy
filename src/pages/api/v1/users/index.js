import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hasEmployeeRole, normalizeRoles, primaryRoleFromRoles, userRoles } from "@/lib/roles";

const STAFF_ROLES = ["ADMIN", "TEACHER", "COACH"];

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
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
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage users" });
  }

  if (req.method === "GET") {
    const { centerId, role, roles, staffOnly } = req.query || {};
    const parsedRoles = []
      .concat(roles || [])
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const requestedRole = typeof role === "string" ? role.trim().toUpperCase() : "";
    const roleFilter = parsedRoles.length
      ? parsedRoles
      : requestedRole
        ? [requestedRole]
        : staffOnly === "true"
          ? STAFF_ROLES
          : [];

    const where = {};
    if (centerId) {
      where.centers = { some: { centerId: String(centerId) } };
    }
    if (roleFilter.length) {
      where.OR = [
        { role: { in: roleFilter } },
        { roles: { hasSome: roleFilter } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: { centers: true, children: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    return res.status(200).json(users.map(sanitizeUser));
  }

  if (req.method === "POST") {
    // Create new user
    const { email, name, password, role, roles, centerId, dob, hireDate, aboutMe, pictureUrl } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedCenterId = centerId ? String(centerId).trim() : "";

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const assignedRoles = normalizeRoles(roles || role, role || "PARENT");
    const primaryRole = primaryRoleFromRoles(assignedRoles, "PARENT");
    const centerRole = assignedRoles.includes("TEACHER")
      ? "TEACHER"
      : assignedRoles.includes("COACH")
        ? "COACH"
        : primaryRole;
    const isEmployee = hasEmployeeRole(assignedRoles);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing)
      return res.status(409).json({ error: "Email already exists" });

    if (normalizedCenterId) {
      const center = await prisma.center.findUnique({
        where: { id: normalizedCenterId },
        select: { id: true },
      });
      if (!center) {
        return res.status(400).json({ error: "Invalid centerId" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name ? String(name) : null,
          password: passwordHash,
          dob: isEmployee ? parseOptionalDate(dob) : null,
          hireDate: isEmployee ? parseOptionalDate(hireDate) : null,
          aboutMe: isEmployee && aboutMe ? String(aboutMe).slice(0, 5000) : null,
          pictureUrl: isEmployee && pictureUrl ? String(pictureUrl).slice(0, 2000) : null,
          role: primaryRole,
          roles: assignedRoles,
          centers: normalizedCenterId
            ? {
                create: {
                  center: { connect: { id: normalizedCenterId } },
                  role: centerRole,
                },
              }
            : undefined,
        },
        include: { centers: true },
      });

      return res.status(201).json(sanitizeUser(user));
    } catch (e) {
      if (e?.code === "P2002") {
        return res.status(409).json({ error: "Email already exists" });
      }
      if (e?.code === "P2003" || e?.code === "P2025") {
        return res.status(400).json({ error: "Invalid centerId" });
      }
      console.error("Failed to create user", e);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
