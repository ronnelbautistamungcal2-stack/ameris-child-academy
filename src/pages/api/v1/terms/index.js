import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { accountIdForUser } from "@/lib/subscriberAccounts";
import { TERMS_KINDS, clientIp, currentDocuments, pendingTermsFor } from "@/lib/terms";

const label = (kind) => TERMS_KINDS.find((k) => k.value === kind)?.label || kind;

/**
 * GET  /api/v1/terms  -> { pending: [{ id, kind, kindLabel, version, title, body, publishedAt }] }
 *      The current terms the signed-in user still has to accept.
 * POST /api/v1/terms  { documentIds: [...] }  "I agree"
 *      Records each acceptance with the date and time, the user, their active
 *      role and account, IP address and browser (client 2026-11-11). Only the
 *      version in force of each kind can be accepted.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const user = session.user;

  if (req.method === "GET") {
    const pending = await pendingTermsFor(user.id);
    return res.status(200).json({ pending: pending.map((d) => ({ ...d, kindLabel: label(d.kind) })) });
  }

  if (req.method === "POST") {
    const ids = [...new Set((Array.isArray(req.body?.documentIds) ? req.body.documentIds : []).map(String))];
    if (!ids.length) return res.status(400).json({ error: "Choose the terms you agree to" });
    const current = new Set(Object.values(await currentDocuments()).map((d) => d.id));
    if (ids.some((id) => !current.has(id))) {
      return res.status(409).json({ error: "These terms have been replaced by a newer version. Reload the page." });
    }
    const accountId = await accountIdForUser(user.id);
    const ipAddress = clientIp(req);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 300) || null;
    for (const documentId of ids) {
      await prisma.termsAcceptance.upsert({
        where: { documentId_userId: { documentId, userId: user.id } },
        create: { documentId, userId: user.id, subscriberAccountId: accountId, role: user.role || null, ipAddress, userAgent },
        update: {},
      });
    }
    return res.status(200).json({ pending: (await pendingTermsFor(user.id)).map((d) => d.id) });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
