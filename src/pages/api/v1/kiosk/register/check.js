import { clearFailures, deviceFromRequest, displayName, recordFailure, rejectIfLockedOut } from "@/lib/kiosk";
import { findByRegistrationCode } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";

// Register PIN screen 1: check the 6-digit registration number an admin gave
// the person and greet them by name ("Welcome Bonnie Kingston!").
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  if (!device) return res.status(403).json({ error: "This device is not set up as a kiosk" });
  if (rejectIfLockedOut(res, device)) return;

  const credential = await findByRegistrationCode(prisma, String(req.body?.code || ""));
  if (!credential || credential.user?.disabled) {
    await recordFailure(prisma, device);
    return res.status(401).json({ error: "That registration number is not valid or has expired." });
  }
  await clearFailures(prisma, device);
  return res.status(200).json({ name: displayName(credential) });
}
