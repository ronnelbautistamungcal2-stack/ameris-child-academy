import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    if (req.method !== "PUT") {
      res.setHeader("Allow", ["PUT"]);
      return res.status(405).end();
    }

    const { id } = req.query;
    const record = await prisma.staffAttendance.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const { clockIn, clockOut, status, lateMinutes, notes } = req.body || {};
    const data = {};
    if (clockIn !== undefined) data.clockIn = clockIn ? new Date(clockIn) : null;
    if (clockOut !== undefined) data.clockOut = clockOut ? new Date(clockOut) : null;
    if (status !== undefined) data.status = status;
    if (lateMinutes !== undefined) data.lateMinutes = lateMinutes;
    if (notes !== undefined) data.notes = notes;
    data.recordedById = session.user.id;

    const updated = await prisma.staffAttendance.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("staff-attendance/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
