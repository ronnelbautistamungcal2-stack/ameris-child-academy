import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  "Classroom Management",
  "Communication",
  "Curriculum Delivery",
  "Child Engagement",
  "Professionalism",
];

function sanitizeCategories(input) {
  const list = Array.isArray(input) ? input : [];
  const cleaned = [];
  const seen = new Set();
  for (const raw of list) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
  }
  return cleaned;
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { centerId } = req.query;
    if (!centerId) return res.status(400).json({ error: "centerId is required" });

    if (req.method === "GET") {
      const config = await prisma.evaluationCategoryConfig.findUnique({ where: { centerId } });
      const categories = config?.categories?.length ? config.categories : DEFAULT_CATEGORIES;
      return res.status(200).json({ centerId, categories });
    }

    if (req.method === "PUT") {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can update evaluation categories" });
      }

      const categories = sanitizeCategories(req.body?.categories);
      if (categories.length === 0) {
        return res.status(400).json({ error: "At least one category is required" });
      }

      const config = await prisma.evaluationCategoryConfig.upsert({
        where: { centerId },
        create: { centerId, categories },
        update: { categories },
      });
      return res.status(200).json({ centerId: config.centerId, categories: config.categories });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("evaluation-category-config error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
