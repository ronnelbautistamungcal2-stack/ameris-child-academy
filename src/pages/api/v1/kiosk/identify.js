import {
  childrenFor,
  clearFailures,
  deviceFromRequest,
  displayName,
  isEmployeeAt,
  issueActionToken,
  recordFailure,
  rejectIfLockedOut,
  staffStatusFor,
} from "@/lib/kiosk";
import { findByPin, isValidPin } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";

// Kiosk front screen: a person enters their PIN. Returns who they are and what
// they can do at this center: clock in/out (staff) and/or sign children in/out
// (parents and authorized pickup people), plus a short-lived pass for it.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  if (!device) return res.status(403).json({ error: "This device is not set up as a kiosk" });
  if (rejectIfLockedOut(res, device.id)) return;

  const pin = String(req.body?.pin || "");
  const credential = isValidPin(pin) ? await findByPin(prisma, pin) : null;
  if (!credential || credential.user?.disabled) {
    recordFailure(device.id);
    return res.status(401).json({ error: "That PIN was not recognized. Please try again." });
  }
  clearFailures(device.id);

  const centerId = device.centerId;
  const employee = credential.user && (await isEmployeeAt(prisma, credential.user, centerId))
    ? await staffStatusFor(prisma, credential.user, centerId)
    : null;
  const children = await childrenFor(prisma, credential, centerId);
  const parent = children.length ? { children } : null;

  if (!employee && !parent) {
    return res.status(403).json({ error: "There is nothing for you to sign in at this center. Please see the front desk." });
  }

  return res.status(200).json({
    token: issueActionToken({ credentialId: credential.id, deviceId: device.id }),
    name: displayName(credential),
    employee,
    parent,
  });
}
