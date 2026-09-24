import { getSession } from "@/lib/auth";
import {
  isParentSession,
  loadParentChildren,
  proximityError,
  proximityForChildren,
} from "@/lib/parentSignInServer";

/**
 * POST { latitude, longitude } -> whether the parent is close enough to sign
 * children in or out. The dialog calls this before asking for the PIN so a
 * parent who is too far away is told so straight away; the sign-in request
 * itself repeats the check.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isParentSession(session)) return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { latitude, longitude } = req.body || {};
  const children = await loadParentChildren(session.user.id);
  const proximity = proximityForChildren(
    children,
    { latitude, longitude },
    { requireAll: false },
  );

  if (proximity.ok) return res.status(200).json({ withinRange: true });

  return res.status(200).json({
    withinRange: false,
    code: proximity.reason,
    error: proximityError(proximity),
    centerName: proximity.centerName || null,
    distanceMeters: proximity.distanceMeters ?? null,
    radiusMeters: proximity.radiusMeters ?? null,
  });
}
