import { startOfDay } from "@/lib/attendance-classroom";
import { deviceFromRequest, initialsOf, isEmployeeAt, readActionToken, staffStatusFor } from "@/lib/kiosk";
import prisma from "@/lib/prisma";

// Kiosk employee screen: Clock In / Clock Out. Writes today's StaffAttendance
// row (one per person per day) with the person's initials in the By columns.
// Clocking in again after clocking out reopens the day: the first clock-in
// time stays and the clock-out is cleared.
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
  const user = credential?.user;
  if (!user || user.disabled || !(await isEmployeeAt(prisma, user, device.centerId))) {
    return res.status(403).json({ error: "You cannot clock in at this center." });
  }

  const action = req.body?.action;
  if (!["in", "out"].includes(action)) return res.status(400).json({ error: "action must be in or out" });

  const date = startOfDay();
  const now = new Date();
  const initials = initialsOf(credential);
  const existing = await prisma.staffAttendance.findUnique({ where: { userId_date: { userId: user.id, date } } });

  if (action === "in") {
    if (existing?.clockIn && !existing.clockOut) {
      return res.status(409).json({ error: "You are already clocked in.", status: await staffStatusFor(prisma, user, device.centerId) });
    }
    if (existing) {
      await prisma.staffAttendance.update({
        where: { id: existing.id },
        data: existing.clockIn
          ? { clockOut: null, clockOutBy: null }
          : { clockIn: now, clockInBy: initials, centerId: device.centerId },
      });
    } else {
      await prisma.staffAttendance.create({
        data: { userId: user.id, centerId: device.centerId, date, clockIn: now, clockInBy: initials, status: "PRESENT" },
      });
    }
  } else {
    if (!existing?.clockIn || existing.clockOut) {
      return res.status(409).json({ error: "You are not clocked in.", status: await staffStatusFor(prisma, user, device.centerId) });
    }
    await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: { clockOut: now, clockOutBy: initials },
    });
  }

  return res.status(200).json({ at: now, status: await staffStatusFor(prisma, user, device.centerId) });
}
