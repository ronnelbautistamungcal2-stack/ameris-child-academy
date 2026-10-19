import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { editorInitials, timeChangeAudits } from "@/lib/timeSheets";

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
    const by = await editorInitials(prisma, session.user.id);
    if (clockIn !== undefined) data.clockIn = clockIn ? new Date(clockIn) : null;
    if (clockOut !== undefined) data.clockOut = clockOut ? new Date(clockOut) : null;
    for (const [field, byField] of [["clockIn", "clockInBy"], ["clockOut", "clockOutBy"]]) {
      if (data[field] === undefined) continue;
      const before = record[field] ? record[field].getTime() : null;
      const after = data[field] ? data[field].getTime() : null;
      if (before !== after) data[byField] = data[field] ? by : null;
    }
    // Changes to times already recorded go on the time sheet audit report.
    const audits = timeChangeAudits(
      "staff",
      record,
      { nextIn: data.clockIn, nextOut: data.clockOut },
      { editor: by, editorUserId: session.user.id },
    );
    if (status !== undefined) data.status = status;
    if (lateMinutes !== undefined) data.lateMinutes = lateMinutes;
    if (notes !== undefined) data.notes = notes;
    data.recordedById = session.user.id;

    const [updated] = await prisma.$transaction([
      prisma.staffAttendance.update({
        where: { id },
        data,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      ...audits.map((entry) => prisma.timeSheetAudit.create({ data: entry })),
    ]);

    return res.status(200).json(updated);
  } catch (e) {
    console.error("staff-attendance/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
