import { requireGlobalAdmin } from "@/lib/globalAdmin";
import prisma from "@/lib/prisma";
import { GLOBAL_SECTIONS, isGlobalAdministrator, permissionsOf, teamRoleOf } from "@/lib/globalPermissions";

/**
 * GET /api/v1/global/me -> { teamRole, permissions, manageUsers }
 * The signed-in Ameris team member's rights, for the Global admin menu and
 * buttons (Permissions & Users).
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { globalTeamRole: true, globalPermissions: true } });
  return res.status(200).json({
    teamRole: teamRoleOf(me),
    permissions: permissionsOf(me),
    manageUsers: isGlobalAdministrator(me),
    sections: GLOBAL_SECTIONS,
  });
}
