// "I agree" terms (client 2026-11-11). Each kind has versions; the latest
// published version is in force. Kinds marked atLogin must be accepted by
// every signed-in user (staff and parents) before they can use the portal;
// the middleware sends them to /terms while token.termsPending is set.

import prisma from "@/lib/prisma";
import { normalizeRoles } from "@/lib/roles";

export const TERMS_KINDS = [
  { value: "END_USER", label: "End-User Terms of Use", atLogin: true, help: "Every staff member and parent accepts it at their next login." },
  { value: "TERMS_OF_SERVICE", label: "Website Terms of Service", atLogin: true, help: "Once published, everyone accepts it at their next login too." },
  {
    value: "SUBSCRIBER_AGREEMENT",
    label: "Subscriber Agreement (Home Daycare)",
    atLogin: false,
    help: "For Home Daycare sign-up with an \"I agree\" box (enrollment, coming with payments). Centers sign theirs through DocuSign.",
  },
];

const LOGIN_KINDS = TERMS_KINDS.filter((k) => k.atLogin).map((k) => k.value);

/** Ameris global admins who aren't also center staff don't accept end-user terms. */
export function mustAcceptTerms(user) {
  const roles = normalizeRoles(user?.roles, user?.role);
  return roles.some((r) => r !== "GLOBAL_ADMIN");
}

/** The version in force of each kind given, by kind. */
export async function currentDocuments(kinds = TERMS_KINDS.map((k) => k.value), db = prisma) {
  const docs = await db.termsDocument.findMany({ where: { kind: { in: kinds } }, orderBy: { publishedAt: "desc" } });
  const out = {};
  for (const d of docs) if (!out[d.kind]) out[d.kind] = d;
  return out;
}

/** The login terms the user hasn't accepted yet (latest versions only). */
export async function pendingTermsFor(userId, db = prisma) {
  if (!userId) return [];
  const user = await db.user.findUnique({ where: { id: String(userId) }, select: { role: true, roles: true } });
  if (!user || !mustAcceptTerms(user)) return [];
  const current = Object.values(await currentDocuments(LOGIN_KINDS, db));
  if (!current.length) return [];
  const accepted = new Set(
    (await db.termsAcceptance.findMany({ where: { userId: String(userId), documentId: { in: current.map((d) => d.id) } }, select: { documentId: true } })).map(
      (a) => a.documentId,
    ),
  );
  return current.filter((d) => !accepted.has(d.id));
}

export async function hasPendingTerms(userId, db = prisma) {
  try {
    return (await pendingTermsFor(userId, db)).length > 0;
  } catch {
    // Never lock people out because of a lookup error.
    return false;
  }
}

export function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (forwarded || req.headers["x-real-ip"] || req.socket?.remoteAddress || "").toString().slice(0, 100) || null;
}
