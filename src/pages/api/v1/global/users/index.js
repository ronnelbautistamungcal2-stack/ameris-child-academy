import { roleLabel, userRoles } from "@/lib/roles";
import bcrypt from "bcryptjs";
import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";
import { TEAM_ROLES, permissionsOf, roleDefaults, teamRoleOf, teamRolesOf } from "@/lib/globalPermissions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function teamUser(u) {
  return {
    id: u.id,
    name: u.name || "",
    email: u.email,
    disabled: Boolean(u.disabled),
    teamRole: teamRoleOf(u),
    teamRoles: teamRolesOf(u),
    customPermissions: Boolean(u.globalPermissions),
    permissions: permissionsOf(u),
    createdAt: u.createdAt,
  };
}

export const TEAM_SELECT = { id: true, name: true, email: true, disabled: true, globalTeamRole: true, globalPermissions: true, createdAt: true };
export const TEAM_WHERE = { OR: [{ role: "GLOBAL_ADMIN" }, { roles: { has: "GLOBAL_ADMIN" } }] };

/**
 * GET  /api/v1/global/users  -> { users, roles }  the Ameris Solutions team
 * POST /api/v1/global/users  { name, email, password, teamRole, addExisting? }  + Add User
 *      An email that already has an account (e.g. a center admin) answers 409
 *      { existing: { name, roles } }; with addExisting the Global admin role is
 *      added to that account, which keeps its password and other roles
 *      (client sheet 10-29 (11), row 61).
 *      Creates a Global admin user who must choose a new password at first
 *      sign-in. Only Global Administrators manage the team.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "USERS");
  if (!session) return undefined;

  if (req.method === "GET") {
    const users = await prisma.user.findMany({ where: TEAM_WHERE, select: TEAM_SELECT, orderBy: [{ name: "asc" }, { email: "asc" }] });
    return res.status(200).json({ users: users.map(teamUser), roles: TEAM_ROLES, roleDefaults: Object.fromEntries(TEAM_ROLES.map((r) => [r.value, roleDefaults(r.value)])) });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const teamRole = TEAM_ROLES.find((r) => r.value === body.teamRole)?.value;
    if (!name) return res.status(400).json({ error: "Enter a name" });
    if (!EMAIL.test(email)) return res.status(400).json({ error: "Enter a valid email" });
    if (!teamRole) return res.status(400).json({ error: "Choose a role" });
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true, roles: true } });
    if (existing) {
      const held = userRoles(existing);
      if (held.includes("GLOBAL_ADMIN")) return res.status(409).json({ error: "That person is already on the Ameris Solutions team" });
      if (!body.addExisting) {
        return res.status(409).json({ error: "Someone already uses that email", existing: { name: existing.name, roles: held.map(roleLabel) } });
      }
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: { roles: [...held, "GLOBAL_ADMIN"], globalTeamRole: teamRole },
        select: TEAM_SELECT,
      });
      return res.status(200).json({ ...teamUser(user), addedToExisting: true });
    }
    if (password.length < 8) return res.status(400).json({ error: "The temporary password must be at least 8 characters" });
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        mustChangePassword: true,
        role: "GLOBAL_ADMIN",
        roles: ["GLOBAL_ADMIN"],
        globalTeamRole: teamRole,
      },
      select: TEAM_SELECT,
    });
    return res.status(201).json(teamUser(user));
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
