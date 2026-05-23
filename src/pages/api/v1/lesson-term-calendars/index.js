import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function normalizeDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function normalizeCalendarRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: row?.id || null,
      term: String(row?.term || "").trim(),
      startDate: normalizeDateOnly(row?.startDate),
      endDate: normalizeDateOnly(row?.endDate),
    }))
    .filter((row) => row.term && row.startDate && row.endDate)
    .map((row) => {
      if (row.endDate < row.startDate) {
        throw new Error(`Term "${row.term}" has an end date before its start date.`);
      }
      return row;
    });
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { centerId } = req.query;
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const calendars = await prisma.lessonTermCalendar.findMany({
      where: { centerId },
      orderBy: [{ startDate: "asc" }, { term: "asc" }],
    });
    return res.status(200).json(calendars);
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update term calendars" });
    }

    let rows;
    try {
      rows = normalizeCalendarRows(req.body?.calendars);
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid term calendar data" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.lessonTermCalendar.deleteMany({ where: { centerId } });
      if (rows.length) {
        await tx.lessonTermCalendar.createMany({
          data: rows.map((row) => ({
            centerId,
            term: row.term,
            startDate: row.startDate,
            endDate: row.endDate,
          })),
        });
      }
    });

    const calendars = await prisma.lessonTermCalendar.findMany({
      where: { centerId },
      orderBy: [{ startDate: "asc" }, { term: "asc" }],
    });
    return res.status(200).json(calendars);
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
