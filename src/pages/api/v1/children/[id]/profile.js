import { getSession } from "@/lib/auth";
import { PROFILE_INCLUDE, buildProfile, profileAccess } from "@/lib/childProfileServer";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/children/:id/profile
 * Student Profile (client mockups 07-01..03): the header, Family, Classroom,
 * Emergency Contacts, About and Red Flags sections, the switcher list and
 * what the viewer may edit. Linked parents, staff who track the child, admins.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const child = await prisma.child.findUnique({ where: { id: String(req.query.id) }, include: PROFILE_INCLUDE });
  if (!child) return res.status(404).json({ error: "Child not found" });
  const access = await profileAccess(session.user, child);
  if (!access.view) return res.status(403).json({ error: "Forbidden" });
  return res.status(200).json(await buildProfile(session.user, child, access));
}
