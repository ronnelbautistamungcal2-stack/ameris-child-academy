import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { centerId } = req.query;
  if (role !== "ADMIN" && !centerId) {
    return res.status(400).json({ error: "centerId is required" });
  }
  if (centerId && role !== "ADMIN") {
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }

  const since = daysAgo(7);

  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(centerId
        ? {
            centers: {
              some: { centerId, role: "TEACHER" },
            },
          }
        : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const teacherIds = teachers.map((t) => t.id);
  const logs = teacherIds.length
    ? await prisma.activityLog.findMany({
        where: {
          recordedById: { in: teacherIds },
          createdAt: { gte: since },
        },
        select: { recordedById: true, createdAt: true },
        take: 5000,
      })
    : [];

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const counts = new Map();
  for (const t of teachers) {
    counts.set(t.id, { last7Days: 0, last24Hours: 0 });
  }

  for (const l of logs) {
    const row = counts.get(l.recordedById);
    if (!row) continue;
    row.last7Days += 1;
    if (l.createdAt >= last24h) row.last24Hours += 1;
  }

  return res.status(200).json({
    since: since.toISOString(),
    centerId: centerId || null,
    teachers: teachers.map((t) => ({
      ...t,
      logs: counts.get(t.id) || { last7Days: 0, last24Hours: 0 },
    })),
  });
}

