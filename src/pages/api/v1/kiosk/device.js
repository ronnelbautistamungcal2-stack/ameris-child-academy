import { deviceFromRequest } from "@/lib/kiosk";
import prisma from "@/lib/prisma";

// Whether this browser is an enrolled kiosk, and for which center. Needs no
// sign-in: the kiosk page asks this on load.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  // serverTime: the kiosk clock shows the server's time, which is the time
  // that gets recorded (client 2026-11-20: they didn't match the device).
  const serverTime = new Date().toISOString();
  if (!device) return res.status(200).json({ enrolled: false, serverTime });
  return res.status(200).json({
    enrolled: true,
    serverTime,
    device: { id: device.id, name: device.name },
    center: device.center,
  });
}
