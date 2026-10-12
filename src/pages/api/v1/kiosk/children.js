import { startOfDay } from "@/lib/attendance-classroom";
import { childrenFor, deviceFromRequest, initialsOf, readActionToken } from "@/lib/kiosk";
import prisma from "@/lib/prisma";

// Kiosk parent screen: sign one or more children in or out. Only children this
// person may pick up at the device's center are accepted. Writes today's
// Attendance row with the person's initials in the By columns. Signing a child
// in again after signing out keeps the first sign-in time and clears the out.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const device = await deviceFromRequest(prisma, req);
  if (!device) return res.status(403).json({ error: "This device is not set up as a kiosk" });

  const credentialId = readActionToken(req.body?.token, device.id);
  if (!credentialId) return res.status(401).json({ error: "Your session timed out. Please enter your PIN again." });
  const credential = await prisma.kioskCredential.findUnique({
    where: { id: credentialId },
    include: { user: true, pickupPerson: true },
  });
  if (!credential || credential.user?.disabled) return res.status(403).json({ error: "Forbidden" });

  const action = req.body?.action;
  if (!["in", "out"].includes(action)) return res.status(400).json({ error: "action must be in or out" });
  const requested = [...new Set((Array.isArray(req.body?.childIds) ? req.body.childIds : []).map(String))];
  if (!requested.length) return res.status(400).json({ error: "Choose at least one child" });

  const allowed = await childrenFor(prisma, credential, device.centerId);
  const allowedIds = new Set(allowed.map((c) => c.id));
  if (requested.some((id) => !allowedIds.has(id))) {
    return res.status(403).json({ error: "You cannot sign in one or more of these children." });
  }

  const day = startOfDay();
  const now = new Date();
  const initials = initialsOf(credential);
  const kids = await prisma.child.findMany({
    where: { id: { in: requested } },
    select: { id: true, centerId: true, classRoomId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const child of kids) {
      const existing = await tx.attendance.findUnique({ where: { childId_day: { childId: child.id, day } } });
      if (action === "in") {
        if (existing?.checkedInAt && !existing.checkedOutAt) continue; // already signed in
        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: existing.checkedInAt
              ? { checkedOutAt: null, checkOutBy: null }
              : { checkedInAt: now, checkInBy: initials },
          });
        } else {
          await tx.attendance.create({
            data: {
              childId: child.id,
              centerId: child.centerId,
              day,
              classRoomId: child.classRoomId || null,
              checkedInAt: now,
              checkInBy: initials,
            },
          });
        }
      } else if (existing?.checkedInAt && !existing.checkedOutAt) {
        await tx.attendance.update({ where: { id: existing.id }, data: { checkedOutAt: now, checkOutBy: initials } });
      }
    }
  });

  return res.status(200).json({ at: now, children: await childrenFor(prisma, credential, device.centerId) });
}
