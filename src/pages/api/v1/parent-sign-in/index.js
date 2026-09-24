import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { startOfDay } from "@/lib/attendance-classroom";
import {
  getPinHash,
  isParentSession,
  loadParentChildren,
  proximityError,
  proximityForChildren,
  serializeChild,
  signInStatus,
  verifyPin,
} from "@/lib/parentSignInServer";

const ACTIONS = ["IN", "OUT"];

/**
 * GET  -> whether the parent has a PIN yet (the dialog asks them to create one
 *         the first time).
 * POST -> sign children in or out. Body:
 *         { pin, latitude, longitude, changes: [{ childId, action: "IN"|"OUT" }] }
 *         The PIN and the geofence are both checked here, whatever the dialog
 *         already checked, and the time recorded is the server's.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!isParentSession(session)) return res.status(403).json({ error: "Forbidden" });

  const userId = session.user.id;

  if (req.method === "GET") {
    const hash = await getPinHash(userId);
    return res.status(200).json({ hasPin: !!hash });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  const { pin, latitude, longitude, changes } = req.body || {};

  const requested = new Map();
  for (const change of Array.isArray(changes) ? changes : []) {
    const childId = typeof change?.childId === "string" ? change.childId : "";
    const action = String(change?.action || "").toUpperCase();
    if (!childId || !ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Each change needs a childId and an action of IN or OUT." });
    }
    requested.set(childId, action);
  }
  if (!requested.size) {
    return res.status(400).json({ error: "Select at least one child." });
  }

  const pinError = await verifyPin(userId, pin);
  if (pinError) return res.status(pinError.status).json({ error: pinError.error });

  const linked = await loadParentChildren(userId);
  const byId = new Map(linked.map((child) => [child.id, child]));
  const targets = [...requested.keys()].map((id) => byId.get(id));
  if (targets.some((child) => !child)) {
    return res.status(403).json({ error: "You can only sign in your own children." });
  }

  const proximity = proximityForChildren(targets, { latitude, longitude });
  if (!proximity.ok) {
    return res.status(403).json({
      error: proximityError(proximity),
      code: proximity.reason,
      centerName: proximity.centerName || null,
      distanceMeters: proximity.distanceMeters ?? null,
      radiusMeters: proximity.radiusMeters ?? null,
    });
  }

  for (const child of targets) {
    const current = signInStatus(child).status;
    const action = requested.get(child.id);
    if (action === "IN" && current === "SIGNED_IN") {
      return res.status(409).json({ error: `${child.firstName} is already signed in.` });
    }
    if (action === "OUT" && current !== "SIGNED_IN") {
      return res.status(409).json({ error: `${child.firstName} is not signed in yet.` });
    }
  }

  const day = startOfDay();
  const now = new Date();

  await prisma.$transaction(
    targets.map((child) => {
      const signIn = requested.get(child.id) === "IN";
      const data = signIn
        ? { checkedInAt: now, checkedInById: userId, checkedOutAt: null, checkedOutById: null }
        : { checkedOutAt: now, checkedOutById: userId };
      return prisma.attendance.upsert({
        where: { childId_day: { childId: child.id, day } },
        update: data,
        create: {
          childId: child.id,
          centerId: child.centerId,
          classRoomId: child.classRoomId || null,
          day,
          ...data,
        },
      });
    }),
  );

  const refreshed = await loadParentChildren(userId);
  return res.status(200).json({
    recordedAt: now.toISOString(),
    children: refreshed.map(serializeChild),
  });
}
