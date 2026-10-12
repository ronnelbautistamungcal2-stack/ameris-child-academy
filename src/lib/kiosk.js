import crypto from "crypto";
import { startOfDay } from "@/lib/attendance-classroom";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { personInitials } from "@/lib/personNames";
import { hasEmployeeRole, userRoles } from "@/lib/roles";

// Front-desk kiosk (client request 2026-10-02). A tablet an admin has enrolled
// stays on /kiosk without anyone signing in. People identify themselves with
// their 6-digit PIN; the kiosk then clocks staff in/out and signs children in/
// out, writing the same Attendance / StaffAttendance rows the admin sees.

export const DEVICE_COOKIE = "ameris_kiosk";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // seconds; browsers cap cookies at 400 days
const ACTION_TOKEN_TTL_MS = 2 * 60 * 1000;

function secret() {
  const value = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("JWT_SECRET or NEXTAUTH_SECRET must be set to use the kiosk");
  return value;
}

export function hashDeviceToken(token) {
  return crypto.createHash("sha256").update(`kiosk-device:${token}`).digest("hex");
}

export function newDeviceToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function deviceCookieHeader(token) {
  const parts = [
    `${DEVICE_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${DEVICE_COOKIE_MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearDeviceCookieHeader() {
  return `${DEVICE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** The enrolled, unrevoked device this request comes from, or null. */
export async function deviceFromRequest(prisma, req) {
  const token = req.cookies?.[DEVICE_COOKIE];
  if (!token) return null;
  const device = await prisma.kioskDevice.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
    include: { center: { select: { id: true, name: true } } },
  });
  if (!device || device.revokedAt) return null;
  // Touch lastSeenAt at most once a minute.
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 60 * 1000) {
    await prisma.kioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  }
  return device;
}

// ---- Short-lived action pass ------------------------------------------------
// After a correct PIN the kiosk gets a signed pass for one person on one
// device, so the follow-up clock or sign-in call never resends the PIN.

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(`kiosk-action:${payload}`).digest("base64url");
}

export function issueActionToken({ credentialId, deviceId }) {
  const payload = Buffer.from(
    JSON.stringify({ c: credentialId, d: deviceId, e: Date.now() + ACTION_TOKEN_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The credential id a pass was issued for, if it is valid for this device. */
export function readActionToken(token, deviceId) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.d !== deviceId || typeof data.e !== "number" || data.e < Date.now()) return null;
    return data.c;
  } catch {
    return null;
  }
}

// ---- Wrong-PIN lockout --------------------------------------------------------
// Per device, kept in memory: 5 failures within 5 minutes lock the device for
// 5 minutes. With several app servers each would count separately.

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;
const failures = new Map(); // deviceId -> timestamps

export function lockoutRemainingMs(deviceId) {
  const now = Date.now();
  const recent = (failures.get(deviceId) || []).filter((t) => now - t < WINDOW_MS);
  failures.set(deviceId, recent);
  if (recent.length < MAX_FAILURES) return 0;
  return WINDOW_MS - (now - recent[recent.length - MAX_FAILURES]);
}

export function recordFailure(deviceId) {
  const list = failures.get(deviceId) || [];
  list.push(Date.now());
  failures.set(deviceId, list.slice(-MAX_FAILURES * 2));
}

export function clearFailures(deviceId) {
  failures.delete(deviceId);
}

/** Sends 429 and returns true when the device is locked out. */
export function rejectIfLockedOut(res, deviceId) {
  const remaining = lockoutRemainingMs(deviceId);
  if (!remaining) return false;
  res.status(429).json({
    error: `Too many incorrect attempts. Please wait ${Math.ceil(remaining / 60000)} minute(s) and try again.`,
  });
  return true;
}

// ---- What a person can do at this center's kiosk ---------------------------------

export function displayName(credential) {
  if (credential.user) return credential.user.name || credential.user.email;
  const p = credential.pickupPerson;
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function initialsOf(credential) {
  return personInitials(credential.user || credential.pickupPerson);
}

function ageLabel(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} yrs`;
}

/** Children this person may sign in/out at the device's center, with today's status. */
export async function childrenFor(prisma, credential, centerId) {
  let where;
  if (credential.user) {
    where = buildParentLinkedChildWhere(credential.user.id, { centerId });
  } else {
    where = { centerId, pickupPeople: { some: { pickupPersonId: credential.pickupPerson.id } } };
  }
  const children = await prisma.child.findMany({
    where: {
      AND: [where, { OR: [{ enrollmentEndDate: null }, { enrollmentEndDate: { gte: startOfDay() } }] }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      birthDate: true,
      classRoom: { select: { name: true } },
      attendances: { where: { day: startOfDay() }, select: { checkedInAt: true, checkedOutAt: true } },
    },
    orderBy: [{ firstName: "asc" }],
  });
  return children.map((child) => {
    const today = child.attendances[0];
    return {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      photoUrl: child.photoUrl,
      age: ageLabel(child.birthDate),
      classroom: child.classRoom?.name || null,
      signedIn: Boolean(today?.checkedInAt && !today?.checkedOutAt),
      checkedInAt: today?.checkedInAt || null,
      checkedOutAt: today?.checkedOutAt || null,
    };
  });
}

/** Whether a user works at this center, so may clock in here. */
export async function isEmployeeAt(prisma, user, centerId) {
  if (!user || !hasEmployeeRole(userRoles(user))) return false;
  const membership = await prisma.centerUser.findUnique({
    where: { userId_centerId: { userId: user.id, centerId } },
  });
  return Boolean(membership);
}

export async function staffStatusFor(prisma, user, centerId) {
  const record = await prisma.staffAttendance.findUnique({
    where: { userId_date: { userId: user.id, date: startOfDay() } },
  });
  const clockedIn = Boolean(record?.clockIn && !record?.clockOut);
  return {
    clockedIn,
    clockIn: record?.clockIn || null,
    clockOut: record?.clockOut || null,
    centerMatches: !record || record.centerId === centerId,
  };
}
