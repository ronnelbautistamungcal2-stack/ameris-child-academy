import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherChildFilter } from "@/lib/teacherScope";
import { ageGroupKeyFromBirthDate } from "@/lib/ageUtils";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const {
      centerId,
      type = "progress",
      childId,
      classId,
      ageGroup,
      parentId,
      domain,
      status,
      groupBy = "child",
      from,
      to,
    } = req.query;

    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    // Build child filter
    const childWhere = { centerId };
    if (childId) childWhere.id = childId;
    if (classId) childWhere.classRoomId = classId;
    if (parentId) childWhere.parentId = parentId;
    if (session.user.role === "TEACHER") {
      Object.assign(childWhere, teacherChildFilter(session.user.id));
    }

    const children = await prisma.child.findMany({
      where: childWhere,
      select: {
        id: true, firstName: true, lastName: true, birthDate: true,
        classRoomId: true, parentId: true,
        classRoom: { select: { name: true } },
      },
    });

    let filteredChildren = children;
    if (ageGroup) {
      filteredChildren = children.filter(
        (c) => ageGroupKeyFromBirthDate(c.birthDate) === ageGroup
      );
    }
    const childIds = filteredChildren.map((c) => c.id);
    const childMap = Object.fromEntries(
      filteredChildren.map((c) => [
        c.id,
        {
          name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
          ageGroup: ageGroupKeyFromBirthDate(c.birthDate),
          className: c.classRoom?.name || "Unassigned",
          classId: c.classRoomId,
        },
      ])
    );

    if (!childIds.length) {
      return res.status(200).json({ query: req.query, results: [], total: 0 });
    }

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDateFilter = from || to;

    let results = [];

    if (type === "progress") {
      results = await queryProgress(childIds, childMap, groupBy, status, hasDateFilter, dateFilter);
    } else if (type === "behavior") {
      results = await queryBehavior(childIds, childMap, groupBy, domain, hasDateFilter, dateFilter);
    } else if (type === "attendance") {
      results = await queryAttendance(childIds, childMap, centerId, groupBy, hasDateFilter, dateFilter);
    } else if (type === "activity") {
      results = await queryActivity(childIds, childMap, groupBy, hasDateFilter, dateFilter);
    }

    return res.status(200).json({ query: req.query, results, total: results.length });
  } catch (e) {
    console.error("analytics/query error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function queryProgress(childIds, childMap, groupBy, status, hasDate, dateFilter) {
  const where = { childId: { in: childIds } };
  if (status) where.status = status;

  const progress = await prisma.progress.findMany({
    where,
    include: {
      lesson: { include: { category: { select: { name: true } } } },
    },
  });

  return groupResults(progress, groupBy, childMap, (p) => ({
    status: p.status,
    category: p.lesson?.category?.name || "Uncategorized",
    lessonTitle: p.lesson?.title || "",
    childId: p.childId,
  }));
}

async function queryBehavior(childIds, childMap, groupBy, domain, hasDate, dateFilter) {
  const where = {
    childId: { in: childIds },
    details: { path: ["kind"], equals: "DAILY_GRADE" },
  };
  if (hasDate) where.createdAt = dateFilter;

  const logs = await prisma.activityLog.findMany({
    where,
    select: { childId: true, details: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const entries = logs
    .filter((l) => l.details && l.details.domains)
    .map((l) => ({
      childId: l.childId,
      date: new Date(l.createdAt).toISOString().split("T")[0],
      domains: l.details.domains,
      avg: l.details.domainAvg ?? null,
      targetDomain: domain ? l.details.domains[domain] : null,
    }));

  return groupBehaviorResults(entries, groupBy, childMap, domain);
}

async function queryAttendance(childIds, childMap, centerId, groupBy, hasDate, dateFilter) {
  const where = { centerId, childId: { in: childIds } };
  if (hasDate) where.day = dateFilter;

  const records = await prisma.attendance.findMany({
    where,
    select: { childId: true, day: true },
  });

  return groupResults(records, groupBy, childMap, (r) => ({
    childId: r.childId,
    date: new Date(r.day).toISOString().split("T")[0],
  }));
}

async function queryActivity(childIds, childMap, groupBy, hasDate, dateFilter) {
  const where = { childId: { in: childIds } };
  if (hasDate) where.createdAt = dateFilter;

  const logs = await prisma.activityLog.findMany({
    where,
    select: { childId: true, type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return groupResults(logs, groupBy, childMap, (l) => ({
    childId: l.childId,
    type: l.type,
    date: new Date(l.createdAt).toISOString().split("T")[0],
  }));
}

function groupResults(items, groupBy, childMap, extractor) {
  const groups = {};

  for (const item of items) {
    const data = extractor(item);
    let key;
    if (groupBy === "child") key = data.childId;
    else if (groupBy === "class") key = childMap[data.childId]?.classId || "unknown";
    else if (groupBy === "ageGroup") key = childMap[data.childId]?.ageGroup || "unknown";
    else if (groupBy === "week") key = getWeekKey(data.date || "");
    else if (groupBy === "month") key = (data.date || "").substring(0, 7);
    else if (groupBy === "teacher") key = "all";
    else key = data.childId;

    if (!groups[key]) {
      groups[key] = { groupKey: key, count: 0, label: "" };
      if (groupBy === "child") groups[key].label = childMap[data.childId]?.name || key;
      else if (groupBy === "class") groups[key].label = childMap[data.childId]?.className || key;
      else if (groupBy === "ageGroup") groups[key].label = key;
      else groups[key].label = key;
    }
    groups[key].count++;
  }

  return Object.values(groups).sort((a, b) => b.count - a.count);
}

function groupBehaviorResults(entries, groupBy, childMap, domain) {
  const groups = {};

  for (const entry of entries) {
    let key;
    if (groupBy === "child") key = entry.childId;
    else if (groupBy === "class") key = childMap[entry.childId]?.classId || "unknown";
    else if (groupBy === "ageGroup") key = childMap[entry.childId]?.ageGroup || "unknown";
    else if (groupBy === "domain") key = domain || "all";
    else if (groupBy === "week") key = getWeekKey(entry.date);
    else if (groupBy === "month") key = entry.date.substring(0, 7);
    else key = entry.childId;

    if (!groups[key]) {
      groups[key] = { groupKey: key, count: 0, avgScore: 0, _sum: 0, label: "" };
      if (groupBy === "child") groups[key].label = childMap[entry.childId]?.name || key;
      else if (groupBy === "class") groups[key].label = childMap[entry.childId]?.className || key;
      else groups[key].label = key;
    }
    groups[key].count++;
    const score = domain ? entry.targetDomain : entry.avg;
    if (typeof score === "number") groups[key]._sum += score;
  }

  return Object.values(groups)
    .map((g) => {
      g.avgScore = g.count > 0 ? Math.round((g._sum / g.count) * 100) / 100 : 0;
      delete g._sum;
      return g;
    })
    .sort((a, b) => b.count - a.count);
}

function getWeekKey(dateStr) {
  if (!dateStr) return "unknown";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const onejan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
