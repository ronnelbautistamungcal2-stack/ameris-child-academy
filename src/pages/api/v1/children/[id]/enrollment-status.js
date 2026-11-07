import { getSession, hasAccessToCenter } from "@/lib/auth";
import { isActiveEnrollment, isEnrollmentStatus, latestEnrollmentEntry } from "@/lib/enrollment";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EDITOR_ROLES = ["ADMIN", "COACH"];
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * GET /api/v1/children/:id/enrollment-status -> { name, entries }
 *     Before any entry is saved, the enrollment start and end dates show as
 *     System entries.
 * PUT /api/v1/children/:id/enrollment-status { entries: [{ date, status, notes }] }
 *     adds entries; the latest one sets (or clears) the enrollment end date.
 * Student List > Enrollment Status (client sheet 2026-11-07).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!EDITOR_ROLES.includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });

  const child = await prisma.child.findUnique({
    where: { id: String(req.query.id) },
    select: { id: true, firstName: true, lastName: true, centerId: true, enrollmentStartDate: true, enrollmentEndDate: true },
  });
  if (!child || !(await hasAccessToCenter(session.user.id, child.centerId))) {
    return res.status(404).json({ error: "Child not found" });
  }
  const name = `${child.firstName || ""} ${child.lastName || ""}`.trim();

  const load = async () => {
    const rows = await prisma.childEnrollmentStatusEntry.findMany({
      where: { childId: child.id },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    if (rows.length) return rows.map((e) => ({ ...e, date: dayKey(e.date) }));
    const fresh = await prisma.child.findUnique({ where: { id: child.id }, select: { enrollmentStartDate: true, enrollmentEndDate: true } });
    return [
      fresh.enrollmentStartDate ? { id: "start", date: dayKey(fresh.enrollmentStartDate), status: "ENROLLED", recordedByName: "System", notes: "Initial enrollment." } : null,
      fresh.enrollmentEndDate ? { id: "end", date: dayKey(fresh.enrollmentEndDate), status: "WITHDRAWN", recordedByName: "System", notes: null } : null,
    ].filter(Boolean);
  };

  if (req.method === "GET") return res.status(200).json({ name, entries: await load() });

  if (req.method === "PUT") {
    const rows = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!rows.length) return res.status(400).json({ error: "Add at least one entry" });
    for (const [i, row] of rows.entries()) {
      if (!DATE.test(String(row?.date || "")) || !isEnrollmentStatus(row?.status)) {
        return res.status(400).json({ error: `Entry ${i + 1} needs a date and a status` });
      }
    }
    const editor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    // The first saved entry keeps the start and end dates the child already
    // had, as System entries, so the history doesn't lose them.
    const existing = await prisma.childEnrollmentStatusEntry.count({ where: { childId: child.id } });
    const seeded = existing ? [] : (await load()).map((e) => ({ date: e.date, status: e.status, notes: e.notes, system: true }));
    await prisma.childEnrollmentStatusEntry.createMany({
      data: [
        ...seeded.map((e) => ({ childId: child.id, date: new Date(`${e.date}T00:00:00.000Z`), status: e.status, notes: e.notes || null, recordedByName: "System" })),
        ...rows.map((row) => ({
          childId: child.id,
          date: new Date(`${row.date}T00:00:00.000Z`),
          status: row.status,
          notes: String(row.notes || "").trim().slice(0, 500) || null,
          recordedById: session.user.id,
          recordedByName: editor?.name || editor?.email || null,
        })),
      ],
    });
    const entries = await load();
    const latest = latestEnrollmentEntry(entries);
    const active = isActiveEnrollment(latest.status);
    await prisma.child.update({
      where: { id: child.id },
      data: {
        enrollmentEndDate: active ? null : new Date(`${latest.date}T00:00:00.000Z`),
        ...(active && !child.enrollmentStartDate ? { enrollmentStartDate: new Date(`${latest.date}T00:00:00.000Z`) } : {}),
      },
    });
    return res.status(200).json({ name, entries });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
