import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextWeekRange() {
  const today = startOfDay(new Date());
  const dow = today.getDay(); // 0=Sun
  // days until next Monday
  const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);
  return { nextMonday, nextSunday };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { centerId, classRoomId } = req.query;

  if (!centerId) {
    return res.status(400).json({ error: "centerId is required" });
  }

  if (session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  const { nextMonday, nextSunday } = nextWeekRange();

  // Fetch milestone checklist plans for next week
  const planWhere = {
    centerId,
    periodStart: { gte: nextMonday, lte: nextSunday },
  };
  if (classRoomId) planWhere.classRoomId = classRoomId;

  const plans = await prisma.milestoneChecklistPlan.findMany({
    where: planWhere,
    include: {
      items: {
        where: { lessonId: { not: null } },
        select: {
          lessonId: true,
          lesson: { select: { id: true, title: true } },
        },
      },
    },
  });

  // Collect unique lesson IDs and their titles
  const lessonMap = {};
  for (const plan of plans) {
    for (const item of plan.items) {
      if (item.lessonId && item.lesson) {
        lessonMap[item.lessonId] = item.lesson.title;
      }
    }
  }

  const lessonIds = Object.keys(lessonMap);

  if (lessonIds.length === 0) {
    return res.status(200).json({
      weekStart: nextMonday.toISOString().slice(0, 10),
      weekEnd: nextSunday.toISOString().slice(0, 10),
      supplies: [],
    });
  }

  const supplies = await prisma.lessonSupply.findMany({
    where: { lessonId: { in: lessonIds } },
    include: { lesson: { select: { id: true, title: true } } },
    orderBy: { name: "asc" },
  });

  // Aggregate by name + unit across all lessons
  const aggregated = {};
  for (const s of supplies) {
    const key = `${s.name.toLowerCase()}|${(s.unit || "").toLowerCase()}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        name: s.name,
        unit: s.unit || null,
        totalQuantity: 0,
        category: s.category,
        lessons: [],
      };
    }
    aggregated[key].totalQuantity += s.quantity;
    const lessonTitle = s.lesson?.title || lessonMap[s.lessonId] || "Unknown";
    if (!aggregated[key].lessons.find((l) => l.id === s.lessonId)) {
      aggregated[key].lessons.push({ id: s.lessonId, title: lessonTitle });
    }
  }

  return res.status(200).json({
    weekStart: nextMonday.toISOString().slice(0, 10),
    weekEnd: nextSunday.toISOString().slice(0, 10),
    supplies: Object.values(aggregated).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  });
}
