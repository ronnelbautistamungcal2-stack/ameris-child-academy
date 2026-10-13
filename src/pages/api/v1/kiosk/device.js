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
  if (!device) return res.status(200).json({ enrolled: false });
  return res.status(200).json({
    enrolled: true,
    device: { id: device.id, name: device.name },
    center: device.center,
  });
}
