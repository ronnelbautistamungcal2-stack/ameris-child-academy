import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";
import { isGlobalAdministrator, normalizeMatrix, normalizeTeamRoles } from "@/lib/globalPermissions";
import { TEAM_SELECT, TEAM_WHERE, teamUser } from "./index";

/**
 * PATCH /api/v1/global/users/:id
 *   { name?, teamRoles? (or teamRole), disabled?, permissions? (matrix) | resetPermissions: true }
 *   A person can have several team roles (client sheet 10-29 (11), row 32).
 * Permissions & Users "Save Changes". A Global Administrator can't demote or
 * disable themselves, and the last active Global Administrator stays one.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res, "USERS");
  if (!session) return undefined;
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end();
  }
  const id = String(req.query.id || "");
  const user = await prisma.user.findFirst({ where: { id, ...TEAM_WHERE }, select: TEAM_SELECT });
  if (!user) return res.status(404).json({ error: "Team member not found" });

  const body = req.body || {};
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: "Enter a name" });
    data.name = name;
  }
  if (body.teamRoles !== undefined || body.teamRole !== undefined) {
    const roles = normalizeTeamRoles(body.teamRoles !== undefined ? body.teamRoles : body.teamRole);
    if (!roles.length) return res.status(400).json({ error: "Choose at least one role" });
    data.globalTeamRole = roles.join(",");
  }
  if (body.disabled !== undefined) data.disabled = Boolean(body.disabled);
  if (body.resetPermissions) data.globalPermissions = null;
  else if (body.permissions !== undefined) data.globalPermissions = normalizeMatrix(body.permissions);

  const nextIsAdmin = data.globalTeamRole !== undefined ? isGlobalAdministrator({ globalTeamRole: data.globalTeamRole }) : isGlobalAdministrator(user);
  const nextDisabled = data.disabled ?? user.disabled;
  const losesAdmin = isGlobalAdministrator(user) && (!nextIsAdmin || nextDisabled);
  if (losesAdmin && id === session.user.id) {
    return res.status(400).json({ error: "You can't remove your own Global Administrator access" });
  }
  if (losesAdmin) {
    const others = await prisma.user.findMany({ where: { ...TEAM_WHERE, disabled: false, NOT: { id } }, select: { globalTeamRole: true } });
    if (!others.some((u) => isGlobalAdministrator(u))) {
      return res.status(400).json({ error: "Keep at least one active Global Administrator" });
    }
  }
  const updated = await prisma.user.update({ where: { id }, data, select: TEAM_SELECT });
  return res.status(200).json(teamUser(updated));
}
