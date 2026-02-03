import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d = new Date()) {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday as start
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const userId = session.user.id;

  const [todayCount, weekCount, monthCount] = await Promise.all([
    prisma.activityLog.count({
      where: { recordedById: userId, createdAt: { gte: startOfDay() } },
    }),
    prisma.activityLog.count({
      where: { recordedById: userId, createdAt: { gte: startOfWeek() } },
    }),
    prisma.activityLog.count({
      where: { recordedById: userId, createdAt: { gte: daysAgo(30) } },
    }),
  ]);

  let centersCount = 0;
  let childrenCount = 0;

  if (role === "ADMIN") {
    [centersCount, childrenCount] = await Promise.all([
      prisma.center.count(),
      prisma.child.count(),
    ]);
  } else {
    const memberships = await prisma.centerUser.findMany({
      where: { userId },
      select: { centerId: true },
    });
    const centerIds = memberships.map((m) => m.centerId);
    centersCount = centerIds.length;
    childrenCount = centerIds.length
      ? await prisma.child.count({ where: { centerId: { in: centerIds } } })
      : 0;
  }

  return res.status(200).json({
    activities: { today: todayCount, week: weekCount, last30Days: monthCount },
    access: { centers: centersCount, children: childrenCount },
  });
}

