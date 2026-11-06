import { getSession, hasAccessToCenter } from "@/lib/auth";
import { EMPLOYED_WHERE } from "@/lib/employment";
import prisma from "@/lib/prisma";
import { enrolledWhere } from "@/lib/reportAccess";
import { EMPLOYEE_ROLES } from "@/lib/roles";
import { hoursBetween, roundHours } from "@/lib/timeSheetReport";
import { TIME_SHEET_KINDS, describeSubject, listRows, startOfLocalDay } from "@/lib/timeSheets";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SUBJECTS = 400;

/**
 * GET /api/v1/reports/time-sheets?kind=child|staff&centerId=&from=&to=&population=ALL|CURRENT&mode=sheets|overview
 * Student / Staff Time Sheets (every time sheet in one report) and Student /
 * Staff Time Overview (hours signed in per person) for a date range (client
 * requests 2026-10-29). population CURRENT keeps enrolled children /
 * currently employed staff. The overview lists everyone signed in at all in
 * the range, even if they are no longer attending or employed.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  if (!["ADMIN", "COACH", "HR_STAFF"].includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });
  const kind = req.query.kind === "staff" ? "staff" : "child";
  const { centerId, from, to } = req.query;
  if (!centerId || !DATE.test(String(from || "")) || !DATE.test(String(to || ""))) {
    return res.status(400).json({ error: "centerId, from and to (YYYY-MM-DD) are required" });
  }
  if (from > to) return res.status(400).json({ error: "The start date must be before the end date" });
  if (!(await hasAccessToCenter(session.user.id, String(centerId)))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const overview = req.query.mode === "overview";
  const current = req.query.population === "CURRENT";
  const config = TIME_SHEET_KINDS[kind];
  const start = startOfLocalDay(`${from}T00:00:00`);
  const end = startOfLocalDay(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const inRange = { [config.dayField]: { gte: start, lt: end } };

  // Who was signed in at all in the range.
  const attended = await prisma[config.model].findMany({
    where: { ...inRange, [config.inField]: { not: null }, centerId: String(centerId) },
    select: { [config.subjectField]: true },
    distinct: [config.subjectField],
  });
  const attendedIds = attended.map((r) => r[config.subjectField]);

  let subjects;
  if (kind === "child") {
    subjects = await prisma.child.findMany({
      where: overview
        ? { id: { in: attendedIds } }
        : { centerId: String(centerId), ...(current ? enrolledWhere() : {}) },
      include: {
        parent: { select: { name: true } },
        guardians: { include: { guardian: { select: { name: true } } } },
        center: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: MAX_SUBJECTS,
    });
  } else {
    subjects = await prisma.user.findMany({
      where: overview
        ? { id: { in: attendedIds } }
        : {
            centers: { some: { centerId: String(centerId) } },
            OR: [{ role: { in: EMPLOYEE_ROLES } }, { roles: { hasSome: EMPLOYEE_ROLES } }],
            ...(current ? EMPLOYED_WHERE : {}),
          },
      select: { id: true, name: true, email: true, role: true, roles: true, employmentStatus: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: MAX_SUBJECTS,
    });
  }

  const people = [];
  for (const subject of subjects) {
    const rows = await listRows(prisma, kind, subject, { from: `${from}T00:00:00`, to: `${to}T00:00:00` });
    const hours = roundHours(rows.reduce((sum, r) => sum + hoursBetween(r.timeIn, r.timeOut), 0));
    const days = rows.filter((r) => r.timeIn).length;
    const info = describeSubject(kind, subject);
    if (overview) {
      people.push({ ...info, days, hours, current: kind === "child" ? !subject.enrollmentEndDate || subject.enrollmentEndDate >= start : subject.employmentStatus === "CURRENTLY_EMPLOYED" });
    } else {
      people.push({ ...info, rows, days, hours });
    }
  }
  const center = await prisma.center.findUnique({ where: { id: String(centerId) }, select: { id: true, name: true } });
  return res.status(200).json({ kind, mode: overview ? "overview" : "sheets", from, to, center, people, truncated: subjects.length >= MAX_SUBJECTS });
}
