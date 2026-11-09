import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/v1/lessons/search?centerId=&kind=step|lesson&q=&limit=&exclude=id,id
 * Type-ahead for the lesson and step pickers: up to `limit` (max 50) matches
 * on title, Ref ID, subject or category, plus the total number of matches.
 * Used instead of loading the whole bank, which can be tens of thousands of
 * steps. Responds { items: [{ id, title, reference, subCategory, categoryId,
 * category: { name, ageRange } }], total }.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const centerId = String(req.query.centerId || "");
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const q = String(req.query.q || "").trim().slice(0, 100);
    const exclude = String(req.query.exclude || "").split(",").filter(Boolean).slice(0, 20);
    const where = { centerId };
    if (req.query.kind === "step") where.isStep = true;
    if (req.query.kind === "lesson") where.isStep = false;
    if (exclude.length) where.id = { notIn: exclude };
    if (q) {
      const contains = { contains: q, mode: "insensitive" };
      where.OR = [{ title: contains }, { reference: contains }, { subCategory: contains }, { category: { name: contains } }];
    }

    const [items, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        select: {
          id: true,
          title: true,
          reference: true,
          subCategory: true,
          categoryId: true,
          category: { select: { name: true, ageRange: true } },
        },
        orderBy: [{ title: "asc" }, { reference: "asc" }],
        take: limit,
      }),
      prisma.lesson.count({ where }),
    ]);
    return res.status(200).json({ items, total });
  } catch (e) {
    console.error("lesson search error:", e);
    return res.status(500).json({ error: "Search failed" });
  }
}
