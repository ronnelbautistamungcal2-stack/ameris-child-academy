import { getSession } from "@/lib/auth";
import { guideAccountId, importAmerisGuide, importStatus } from "@/lib/characterGuideServer";
import { hasAnyRole } from "@/lib/roles";

/**
 * GET  /api/v1/character-guide/import
 *      { canImport, reason, ameris: { categories, behaviors }, missing, imported }
 * POST /api/v1/character-guide/import   -> { categoriesAdded, behaviorsAdded }
 *      Copies the Ameris Character Guide into the admin's account (step D).
 *      Needs the Teacher Training add-on. Running it again only adds Ameris
 *      behaviors not imported before; the account's own edits are kept.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN" || !hasAnyRole(session.user, ["ADMIN"])) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") return res.status(200).json(await importStatus(session.user));

  if (req.method === "POST") {
    const status = await importStatus(session.user);
    if (!status.canImport) return res.status(status.missing === 0 && status.ameris.behaviors ? 409 : 403).json({ error: status.reason });
    const result = await importAmerisGuide(await guideAccountId(session.user), session.user.id);
    return res.status(200).json(result);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
