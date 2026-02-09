import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeLessonCategoriesForCenter } from "@/lib/lessonCategoryNormalization.mjs";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can normalize categories" });
  }

  const { centerId } = req.body || {};
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  const hasAccess = await hasAccessToCenter(session.user.id, centerId);
  if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

  const summary = await normalizeLessonCategoriesForCenter({ prisma, centerId });
  return res.status(200).json(summary);
}

