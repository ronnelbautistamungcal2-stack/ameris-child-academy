import { getSession } from "@/lib/auth";
import {
  isParentSession,
  loadParentChildren,
  resetPinWithPassword,
  serializeChild,
} from "@/lib/parentSignInServer";

/**
 * Forgot PIN. POST { password, pin, confirmPin } -> checks the account
 * password, replaces the PIN, and returns the children the same way the PIN
 * endpoint does so the dialog can carry straight on.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isParentSession(session)) return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { password, pin, confirmPin } = req.body || {};
  const failure = await resetPinWithPassword(session.user.id, password, pin, confirmPin);
  if (failure) return res.status(failure.status).json({ error: failure.error });

  const children = await loadParentChildren(session.user.id);
  return res.status(200).json({ children: children.map(serializeChild) });
}
