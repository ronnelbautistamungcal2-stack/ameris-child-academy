import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { teacherChildFilter } from "@/lib/teacherScope";

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

    const { centerId, childId, classId, from, to, groupBy = "day" } = req.query;
    if (!centerId && !childId) {
      return res.status(400).json({ error: "centerId or childId is required" });
    }

    // Build child filter
    const childWhere = {};
    if (centerId) childWhere.centerId = centerId;
    if (childId) childWhere.id = childId;
    if (classId) childWhere.classRoomId = classId;
    if (session.user.role === "TEACHER") {
      Object.assign(childWhere, teacherChildFilter(session.user.id));
    }

    const children = await prisma.child.findMany({
      where: childWhere,
      select: { id: true, firstName: true, lastName: true },
    });
    const childIds = children.map((c) => c.id);
    const childNameMap = Object.fromEntries(
      children.map((c) => [c.id, `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`])
    );

    if (!childIds.length) {
      return res.status(200).json({ scores: [], aggregated: {} });
    }

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const logs = await prisma.activityLog.findMany({
      where: {
        childId: { in: childIds },
        details: { path: ["kind"], equals: "DAILY_GRADE" },
        ...(from || to ? { createdAt: dateFilter } : {}),
      },
      select: { childId: true, details: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Individual scores
    const scores = logs
      .filter((l) => l.details && l.details.domains)
      .map((l) => ({
        date: new Date(l.createdAt).toISOString().split("T")[0],
        childId: l.childId,
        childName: childNameMap[l.childId] || "",
        domains: l.details.domains,
        avg: l.details.domainAvg ?? null,
      }));

    // Aggregated domain stats
    const domainKeys = ["cognitive", "social", "physical", "language", "creative"];
    const aggr = {};
    for (const key of domainKeys) {
      const vals = scores.map((s) => s.domains[key]).filter((v) => typeof v === "number");
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sorted = [...vals].sort((a, b) => a - b);
        // Compute trend: compare first half vs second half
        const mid = Math.floor(vals.length / 2);
        const firstHalf = vals.slice(0, mid);
        const secondHalf = vals.slice(mid);
        const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
        let trend = "stable";
        if (secondAvg > firstAvg + 0.2) trend = "improving";
        else if (secondAvg < firstAvg - 0.2) trend = "declining";

        aggr[key] = {
          avg: Math.round(avg * 100) / 100,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          count: vals.length,
          trend,
        };
      } else {
        aggr[key] = { avg: 0, min: 0, max: 0, count: 0, trend: "stable" };
      }
    }

    // Group scores if requested
    let grouped = scores;
    if (groupBy === "week" || groupBy === "month") {
      const map = {};
      for (const s of scores) {
        const key = groupBy === "week" ? getWeekKey(s.date) : s.date.substring(0, 7);
        if (!map[key]) {
          map[key] = { label: key, _sums: {}, _counts: {} };
          for (const dk of domainKeys) {
            map[key]._sums[dk] = 0;
            map[key]._counts[dk] = 0;
          }
        }
        for (const dk of domainKeys) {
          if (typeof s.domains[dk] === "number") {
            map[key]._sums[dk] += s.domains[dk];
            map[key]._counts[dk] += 1;
          }
        }
      }
      grouped = Object.values(map)
        .map((g) => {
          const entry = { label: g.label };
          for (const dk of domainKeys) {
            entry[dk] = g._counts[dk] > 0
              ? Math.round((g._sums[dk] / g._counts[dk]) * 100) / 100
              : null;
          }
          return entry;
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return res.status(200).json({ scores: grouped, aggregated: aggr });
  } catch (e) {
    console.error("analytics/behavior-scores error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const onejan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
