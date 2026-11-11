import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";
import { TEAM_ROLES, normalizeMatrix, teamRoleOf } from "@/lib/globalPermissions";
import { TEAM_SELECT, TEAM_WHERE, teamUser } from "./index";

/**
 * PATCH /api/v1/global/users/:id
 *   { name?, teamRole?, disabled?, permissions? (matrix) | resetPermissions: true }
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
  if (body.teamRole !== undefined) {
    const role = TEAM_ROLES.find((r) => r.value === body.teamRole)?.value;
    if (!role) return res.status(400).json({ error: "Choose a role" });
    data.globalTeamRole = role;
  }
  if (body.disabled !== undefined) data.disabled = Boolean(body.disabled);
  if (body.resetPermissions) data.globalPermissions = null;
  else if (body.permissions !== undefined) data.globalPermissions = normalizeMatrix(body.permissions);

  const nextRole = data.globalTeamRole || teamRoleOf(user);
  const nextDisabled = data.disabled ?? user.disabled;
  const losesAdmin = teamRoleOf(user) === "GLOBAL_ADMINISTRATOR" && (nextRole !== "GLOBAL_ADMINISTRATOR" || nextDisabled);
  if (losesAdmin && id === session.user.id) {
    return res.status(400).json({ error: "You can't remove your own Global Administrator access" });
  }
  if (losesAdmin) {
    const others = await prisma.user.findMany({ where: { ...TEAM_WHERE, disabled: false, NOT: { id } }, select: { globalTeamRole: true } });
    if (!others.some((u) => teamRoleOf(u) === "GLOBAL_ADMINISTRATOR")) {
      return res.status(400).json({ error: "Keep at least one active Global Administrator" });
    }
  }
  const updated = await prisma.user.update({ where: { id }, data, select: TEAM_SELECT });
  return res.status(200).json(teamUser(updated));
}
