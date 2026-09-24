import { getSession } from "@/lib/auth";
import { isValidPin } from "@/lib/parentSignIn";
import {
  getPinHash,
  isParentSession,
  loadParentChildren,
  serializeChild,
  setPin,
  verifyPin,
} from "@/lib/parentSignInServer";

/**
 * POST { pin }              -> checks the PIN and returns the parent's children
 *                              with today's sign-in status.
 * POST { pin, confirmPin }  -> first time only: creates the PIN, then returns
 *                              the children the same way.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isParentSession(session)) return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const userId = session.user.id;
  const { pin, confirmPin } = req.body || {};

  if (confirmPin !== undefined) {
    if (await getPinHash(userId)) {
      return res.status(409).json({ error: "A PIN is already set for this account." });
    }
    if (!isValidPin(pin)) return res.status(400).json({ error: "Your PIN must be 6 digits." });
    if (pin !== confirmPin) return res.status(400).json({ error: "The PINs do not match." });
    await setPin(userId, pin);
  } else {
    const pinError = await verifyPin(userId, pin);
    if (pinError) return res.status(pinError.status).json({ error: pinError.error });
  }

  const children = await loadParentChildren(userId);
  return res.status(200).json({ children: children.map(serializeChild) });
}
