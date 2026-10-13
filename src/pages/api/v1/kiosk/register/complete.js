import { deviceFromRequest, displayName, recordFailure, rejectIfLockedOut } from "@/lib/kiosk";
import { PinError, setPinWithRegistrationCode } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";

// Register PIN screens 2-4: the person chose a PIN and entered it twice (the
// kiosk compares the two). Sets it if nobody else has it and uses up the code.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  if (!device) return res.status(403).json({ error: "This device is not set up as a kiosk" });
  if (rejectIfLockedOut(res, device)) return;

  try {
    const credential = await setPinWithRegistrationCode(prisma, {
      code: String(req.body?.code || ""),
      pin: String(req.body?.pin || ""),
    });
    return res.status(200).json({ name: displayName(credential) });
  } catch (error) {
    if (!(error instanceof PinError)) throw error;
    if (error.code === "INVALID_CODE") await recordFailure(prisma, device);
    const status = error.code === "PIN_TAKEN" ? 409 : 400;
    return res.status(status).json({ error: error.message, code: error.code });
  }
}
