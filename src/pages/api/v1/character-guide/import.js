import { getSession } from "@/lib/auth";
import { fillGlobalFromAmeris, globalFillStatus, guideAccountId, guideScope, importAmerisGuide, importStatus } from "@/lib/characterGuideServer";
import { hasAnyRole } from "@/lib/roles";

/**
 * GET  /api/v1/character-guide/import
 *      { canImport, reason, ameris: { categories, behaviors }, missing, imported }
 * POST /api/v1/character-guide/import   -> { categoriesAdded, behaviorsAdded, behaviorsUpdated }
 *      Copies the Global Character Guide (row 66) into the admin's account
 *      (step D). Needs the Teacher Training add-on, except Ameris Academy.
 *      Running it again adds new behaviors and brings in changes to ones
 *      imported before.
 * ?guide=global (Global admins): the same for filling the Global guide from
 *      Ameris Academy's guide. GET { canFill, reason, behaviors, missing, updated, editedHere }.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (String(req.query.guide || "") === "global") {
    const scope = await guideScope(req, session);
    if (!scope?.global || !scope.canEdit) return res.status(403).json({ error: "Forbidden" });
    if (req.method === "GET") return res.status(200).json(await globalFillStatus());
    if (req.method === "POST") {
      const status = await globalFillStatus();
      if (!status.canFill) return res.status(409).json({ error: status.reason });
      return res.status(200).json(await fillGlobalFromAmeris(session.user.id));
    }
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  if (session.user.role !== "ADMIN" || !hasAnyRole(session.user, ["ADMIN"])) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") return res.status(200).json(await importStatus(session.user));

  if (req.method === "POST") {
    const status = await importStatus(session.user);
    if (!status.canImport) return res.status(status.missing + status.updated === 0 && status.ameris.behaviors ? 409 : 403).json({ error: status.reason });
    const result = await importAmerisGuide(await guideAccountId(session.user), session.user.id);
    return res.status(200).json(result);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
