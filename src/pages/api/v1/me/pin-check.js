import { getSession } from "@/lib/auth";
import { isValidPin, pinLookupOf } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// Few tries per person: the PIN is only six digits.
const limiter = rateLimit({ interval: 60_000, limit: 6, getKey: (req) => `pin-check:${req.sessionUserId || ""}` });

/**
 * POST /api/v1/me/pin-check { pin }
 * Checks the signed-in person's own kiosk PIN, before a parent signs their
 * children in or out from the dashboard (client sheet 2026-11-07).
 * Responds { ok } or { ok: false, noPin: true } when they have not set one.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  req.sessionUserId = session.user.id;
  if (limiter.check(req).isLimited) return res.status(429).json({ error: "Too many tries. Please wait a minute and try again." });

  const credential = await prisma.kioskCredential.findUnique({ where: { userId: session.user.id }, select: { pinLookup: true } });
  if (!credential?.pinLookup) return res.status(200).json({ ok: false, noPin: true });
  const pin = String(req.body?.pin || "");
  return res.status(200).json({ ok: isValidPin(pin) && pinLookupOf(pin) === credential.pinLookup });
}
