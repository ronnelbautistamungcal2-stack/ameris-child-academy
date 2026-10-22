import { accessibleCenterIds, getSession } from "@/lib/auth";
import { isEmploymentStatus, latestEmploymentStatus } from "@/lib/employment";
import prisma from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EDITOR_ROLES = ["ADMIN", "HR_STAFF"];

/**
 * GET /api/v1/users/:id/employment -> { name, status, entries }
 * PUT /api/v1/users/:id/employment { entries: [{ date, status, notes }] }
 *     adds entries (admins and HR); the latest one becomes the status.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!EDITOR_ROLES.includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });

  const user = await prisma.user.findUnique({
    where: { id: String(req.query.id) },
    select: { id: true, name: true, email: true, employmentStatus: true, centers: { select: { centerId: true } } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  const allowed = await accessibleCenterIds(session.user.id);
  if (allowed && !user.centers.some((c) => allowed.includes(c.centerId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const load = async () => {
    const entries = await prisma.employmentStatusEntry.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    return entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) }));
  };

  if (req.method === "GET") {
    const entries = await load();
    return res.status(200).json({ name: user.name || user.email, status: user.employmentStatus, entries });
  }

  if (req.method === "PUT") {
    const rows = Array.isArray(req.body?.entries) ? req.body.entries : [];
    for (const [i, row] of rows.entries()) {
      if (!DATE.test(String(row?.date || "")) || !isEmploymentStatus(row?.status)) {
        return res.status(400).json({ error: `Entry ${i + 1} needs a date and a status` });
      }
    }
    if (!rows.length) return res.status(400).json({ error: "Add at least one entry" });
    const editor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    await prisma.employmentStatusEntry.createMany({
      data: rows.map((row) => ({
        userId: user.id,
        date: new Date(`${row.date}T00:00:00.000Z`),
        status: row.status,
        notes: String(row.notes || "").trim().slice(0, 500) || null,
        recordedById: session.user.id,
        recordedByName: editor?.name || editor?.email || null,
      })),
    });
    const entries = await load();
    const status = latestEmploymentStatus(entries);
    await prisma.user.update({ where: { id: user.id }, data: { employmentStatus: status } });
    return res.status(200).json({ name: user.name || user.email, status, entries });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).end();
}
