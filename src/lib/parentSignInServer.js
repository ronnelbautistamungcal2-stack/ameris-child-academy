import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { startOfDay } from "@/lib/attendance-classroom";
import { checkProximity, isValidPin, parseCoordinates } from "@/lib/parentSignIn";

// Wrong guesses are counted per account, not per IP, so a phone moving between
// networks cannot reset its allowance. A correct guess clears the count. Held
// in memory, like the other rate limits, so a server restart also clears it.
const MAX_WRONG_GUESSES = 5;
const LOCKOUT_MS = 15 * 60_000;

function guessCounter() {
  const entries = new Map();
  return {
    lockedOut(userId) {
      const entry = entries.get(userId);
      if (!entry) return false;
      if (Date.now() - entry.since > LOCKOUT_MS) {
        entries.delete(userId);
        return false;
      }
      return entry.count >= MAX_WRONG_GUESSES;
    },
    wrong(userId) {
      const entry = entries.get(userId);
      if (!entry || Date.now() - entry.since > LOCKOUT_MS) {
        entries.set(userId, { count: 1, since: Date.now() });
      } else {
        entry.count += 1;
      }
    },
    clear(userId) {
      entries.delete(userId);
    },
  };
}

const wrongPins = guessCounter();
const wrongPasswords = guessCounter();

export function isParentSession(session) {
  return !!session?.user && hasAnyRole(session.user, ["PARENT"]);
}

export async function getPinHash(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signInPinHash: true },
  });
  return user?.signInPinHash || null;
}

/**
 * Checks `pin` against the parent's stored PIN. Returns null on success or
 * `{ status, error }` to send back. The sign-in endpoint goes through here as
 * well, so it cannot be used to guess a PIN around the lockout.
 */
export async function verifyPin(userId, pin) {
  if (wrongPins.lockedOut(userId)) {
    return {
      status: 429,
      error: "Too many PIN attempts. Please wait 15 minutes or use Forgot PIN.",
    };
  }
  if (!isValidPin(pin)) return { status: 400, error: "Enter your 6-digit PIN." };

  const hash = await getPinHash(userId);
  if (!hash) return { status: 409, error: "Create a PIN before signing children in or out." };
  if (await bcrypt.compare(pin, hash)) {
    wrongPins.clear(userId);
    return null;
  }
  wrongPins.wrong(userId);
  return { status: 401, error: "That PIN is not correct." };
}

export async function setPin(userId, pin) {
  const signInPinHash = await bcrypt.hash(pin, 10);
  await prisma.user.update({ where: { id: userId }, data: { signInPinHash } });
}

/**
 * Forgot PIN: the parent proves who they are with their account password and
 * picks a new PIN. Returns null on success or `{ status, error }`. A reset
 * also lifts a wrong-PIN lockout, and the parent is notified so a PIN changed
 * by someone else on an unlocked phone does not go unnoticed.
 */
export async function resetPinWithPassword(userId, password, pin, confirmPin) {
  if (wrongPasswords.lockedOut(userId)) {
    return {
      status: 429,
      error: "Too many password attempts. Please wait 15 minutes or contact the center.",
    };
  }
  if (!isValidPin(pin)) return { status: 400, error: "Your new PIN must be 6 digits." };
  if (pin !== confirmPin) return { status: 400, error: "The new PINs do not match." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user?.password) {
    return {
      status: 409,
      error: "Your account has no password to confirm with. Please contact the center to reset your PIN.",
    };
  }
  if (typeof password !== "string" || !password || !(await bcrypt.compare(password, user.password))) {
    wrongPasswords.wrong(userId);
    return { status: 401, error: "That password is not correct." };
  }

  wrongPasswords.clear(userId);
  await setPin(userId, pin);
  wrongPins.clear(userId);
  await prisma.notification.create({
    data: {
      recipientId: userId,
      type: "SYSTEM",
      title: "Your sign-in PIN was changed",
      body: "The PIN you use to sign children in and out was just reset. If this wasn't you, contact the center right away.",
    },
  });
  return null;
}

const centerSelect = {
  id: true,
  name: true,
  latitude: true,
  longitude: true,
  signInRadiusMeters: true,
};

export async function loadParentChildren(userId) {
  const day = startOfDay();
  return prisma.child.findMany({
    where: buildParentLinkedChildWhere(userId),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      photoUrl: true,
      centerId: true,
      classRoomId: true,
      classRoom: { select: { name: true } },
      center: { select: centerSelect },
      attendances: {
        where: { day },
        select: { checkedInAt: true, checkedOutAt: true },
        take: 1,
      },
    },
    orderBy: [{ birthDate: "asc" }, { firstName: "asc" }],
  });
}

export function signInStatus(child) {
  const today = child.attendances?.[0] || null;
  if (today?.checkedInAt && !today?.checkedOutAt) {
    return { status: "SIGNED_IN", at: today.checkedInAt };
  }
  if (today?.checkedOutAt) return { status: "SIGNED_OUT", at: today.checkedOutAt };
  return { status: "NOT_SIGNED_IN", at: null };
}

export function serializeChild(child) {
  const { status, at } = signInStatus(child);
  return {
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    birthDate: child.birthDate,
    photoUrl: child.photoUrl || null,
    classroomName: child.classRoom?.name || "",
    centerName: child.center?.name || "",
    status,
    statusAt: at,
  };
}

function uniqueCenters(children) {
  const map = new Map();
  for (const child of children) {
    if (child.center && !map.has(child.center.id)) map.set(child.center.id, child.center);
  }
  return [...map.values()];
}

/**
 * Proximity of `position` to the centers the given children attend. With
 * `requireAll` (signing specific children in or out) the parent must be inside
 * every one of those centers' geofences; without it (the dialog's first check)
 * being near any of them is enough. On failure the nearest center is reported.
 */
export function proximityForChildren(children, rawPosition, { requireAll = true } = {}) {
  const position = parseCoordinates(rawPosition?.latitude, rawPosition?.longitude);
  if (!position) {
    return { ok: false, reason: "LOCATION_REQUIRED" };
  }
  const centers = uniqueCenters(children);
  if (!centers.length) return { ok: false, reason: "NO_CHILDREN" };

  const results = centers.map((center) => ({
    centerId: center.id,
    centerName: center.name,
    ...checkProximity(center, position),
  }));

  const nearestOutside = results
    .filter((r) => r.configured && !r.withinRange)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  const unconfigured = results.find((r) => !r.configured);

  if (!requireAll && results.some((r) => r.withinRange)) return { ok: true, results };
  if (requireAll && unconfigured) {
    return { ok: false, reason: "CENTER_NOT_CONFIGURED", ...unconfigured };
  }
  if (nearestOutside) return { ok: false, reason: "TOO_FAR", ...nearestOutside };
  if (unconfigured) return { ok: false, reason: "CENTER_NOT_CONFIGURED", ...unconfigured };

  return { ok: true, results };
}

export function proximityError(proximity) {
  switch (proximity.reason) {
    case "LOCATION_REQUIRED":
      return "Your location is needed to sign children in or out.";
    case "NO_CHILDREN":
      return "No children are linked to this account.";
    case "CENTER_NOT_CONFIGURED":
      return `${proximity.centerName} has not set up sign-in location yet. Please sign in at the front desk.`;
    case "TOO_FAR":
      return "You are too far away from the center to sign children in or out.";
    default:
      return "You cannot sign children in or out from here.";
  }
}
