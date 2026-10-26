import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { centerStaff, trainingAccess } from "@/lib/trainingServer";

const round1 = (n) => Math.round(n * 10) / 10;

function totals(logs) {
  const sum = (key) => round1(logs.reduce((acc, l) => acc + (Number(l[key]) || 0), 0));
  return { hours: sum("hours"), nonInteractiveHours: sum("nonInteractiveHours"), interactiveHours: sum("interactiveHours") };
}

function dateRange(query) {
  const range = {};
  if (query.from) range.gte = new Date(`${String(query.from).slice(0, 10)}T00:00:00.000Z`);
  if (query.to) range.lte = new Date(`${String(query.to).slice(0, 10)}T23:59:59.999Z`);
  return Object.keys(range).length ? range : undefined;
}

/**
 * GET /api/v1/training/hours?centerId=&from=&to=[&userId=]
 * Coach Staff Training (admins, coaches, HR): each current staff member with
 * the training hours they completed in the range. With userId, that person's
 * recorded trainings (View Training); staff may ask for their own.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const centerId = String(req.query.centerId || "");
  const access = await trainingAccess(session, centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const userId = req.query.userId ? String(req.query.userId) : "";
  if (!access.canTrack && userId !== session.user.id) return res.status(403).json({ error: "Forbidden" });
  const date = dateRange(req.query);

  if (userId) {
    const [user, logs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, staffDepartment: true, hireDate: true, pictureUrl: true } }),
      prisma.trainingLog.findMany({ where: { userId, centerId, ...(date ? { date } : {}) }, orderBy: { date: "asc" } }),
    ]);
    if (!user) return res.status(404).json({ error: "Staff member not found" });
    return res.status(200).json({ user, logs, totals: totals(logs) });
  }

  const staff = await centerStaff(centerId);
  const logs = await prisma.trainingLog.findMany({
    where: { centerId, userId: { in: staff.map((s) => s.id) }, ...(date ? { date } : {}) },
    select: { userId: true, hours: true, nonInteractiveHours: true, interactiveHours: true },
  });
  const byUser = {};
  for (const l of logs) (byUser[l.userId] ||= []).push(l);
  return res.status(200).json(
    staff.map((s) => ({
      id: s.id,
      name: s.name || s.email,
      pictureUrl: s.pictureUrl,
      position: roleLabel(s.roles[0] || s.role),
      department: s.staffDepartment || "",
      ...totals(byUser[s.id] || []),
    })),
  );
}
