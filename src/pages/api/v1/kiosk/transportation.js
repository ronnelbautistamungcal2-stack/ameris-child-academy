import { startOfDay } from "@/lib/attendance-classroom";
import { signIn, signOut } from "@/lib/attendanceSessions";
import { carpoolChildren, deviceFromRequest, initialsOf, readActionToken, transportationFor } from "@/lib/kiosk";
import prisma from "@/lib/prisma";

/**
 * Kiosk Transportation (client sheet 10-29 (11), rows 6-8): a bus driver at
 * the device's center picks a carpool and signs its children in or out.
 * POST { token, carpool }                         -> { children }
 * POST { token, carpool, childIds, action: in|out } -> signs them; { at, children }
 * Only children of that carpool at this center are accepted. The By columns
 * get the driver's initials.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  if (!device) return res.status(403).json({ error: "This device is not set up as a kiosk" });

  const credentialId = readActionToken(req.body?.token, device.id);
  if (!credentialId) return res.status(401).json({ error: "Your session timed out. Please enter your PIN again." });
  const credential = await prisma.kioskCredential.findUnique({ where: { id: credentialId }, include: { user: true, pickupPerson: true } });
  if (!credential || credential.user?.disabled) return res.status(403).json({ error: "Forbidden" });

  const transportation = await transportationFor(prisma, credential.user, device.centerId);
  if (!transportation) return res.status(403).json({ error: "Only bus drivers at this center can use Transportation." });
  const carpool = transportation.carpools.find((c) => c.toLowerCase() === String(req.body?.carpool || "").trim().toLowerCase());
  if (!carpool) return res.status(400).json({ error: "Choose a carpool" });

  const action = req.body?.action;
  if (!action) return res.status(200).json({ children: await carpoolChildren(prisma, device.centerId, carpool) });
  if (!["in", "out"].includes(action)) return res.status(400).json({ error: "action must be in or out" });

  const requested = [...new Set((Array.isArray(req.body?.childIds) ? req.body.childIds : []).map(String))];
  if (!requested.length) return res.status(400).json({ error: "Choose at least one child" });
  const allowedIds = new Set((await carpoolChildren(prisma, device.centerId, carpool)).map((c) => c.id));
  if (requested.some((id) => !allowedIds.has(id))) return res.status(403).json({ error: "One or more of these children aren't in this carpool." });

  const day = startOfDay();
  const now = new Date();
  const initials = initialsOf(credential);
  const kids = await prisma.child.findMany({ where: { id: { in: requested } }, select: { id: true, centerId: true, classRoomId: true } });
  await prisma.$transaction(async (tx) => {
    for (const child of kids) {
      const existing = await tx.attendance.findUnique({ where: { childId_day: { childId: child.id, day } } });
      if (action === "in") {
        await signIn(tx, "child", { day: existing, createData: { childId: child.id, centerId: child.centerId, day, classRoomId: child.classRoomId || null } }, now, initials);
      } else {
        await signOut(tx, "child", existing, now, initials);
      }
    }
  });
  return res.status(200).json({ at: now, children: await carpoolChildren(prisma, device.centerId, carpool) });
}
