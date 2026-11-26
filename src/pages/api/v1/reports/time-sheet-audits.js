import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { describeSubject } from "@/lib/timeSheets";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/v1/reports/time-sheet-audits?kind=child|staff&centerId=&from=&to=
 * Student / Staff Audit Report (client sheet 10-29 (11), rows 59/60): every
 * child or employee of the center with anything on their time sheet audit
 * (a changed or deleted time) for days in the range, with those entries.
 * -> { kind, from, to, center, people: [{ id, name, entries: [...] }] }
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
  if (!(await hasAccessToCenter(session.user.id, String(centerId)))) return res.status(403).json({ error: "Forbidden" });

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const entries = await prisma.timeSheetAudit.findMany({
    where: { kind, centerId: String(centerId), day: { gte: start, lt: end } },
    orderBy: [{ day: "asc" }, { changedAt: "asc" }],
    take: 5000,
  });
  const subjectIds = [...new Set(entries.map((e) => (kind === "child" ? e.childId : e.userId)).filter(Boolean))];
  const subjects =
    kind === "child"
      ? await prisma.child.findMany({
          where: { id: { in: subjectIds } },
          include: { parent: { select: { name: true } }, guardians: { include: { guardian: { select: { name: true } } } }, center: { select: { name: true } } },
        })
      : await prisma.user.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, email: true, role: true } });

  const people = subjects
    .map((s) => {
      const info = describeSubject(kind, s);
      const lastName = kind === "child" ? s.lastName || "" : String(s.name || s.email || "").trim().split(/\s+/).pop();
      return {
        id: s.id,
        name: info.name,
        lastName,
        entries: entries
          .filter((e) => (kind === "child" ? e.childId : e.userId) === s.id)
          .map(({ id, day, originalIn, originalInBy, originalOut, originalOutBy, action, newValue, changedAt, changedByInitials }) => ({
            id,
            day,
            originalIn,
            originalInBy,
            originalOut,
            originalOutBy,
            action,
            newValue,
            changedAt,
            changedByInitials,
          })),
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name));

  const center = await prisma.center.findUnique({ where: { id: String(centerId) }, select: { id: true, name: true } });
  return res.status(200).json({ kind, from, to, center, people });
}
