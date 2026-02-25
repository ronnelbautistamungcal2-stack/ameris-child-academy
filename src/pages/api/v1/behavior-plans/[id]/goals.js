import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Plan id is required" });

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    // Verify plan exists
    const plan = await prisma.behaviorPlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const { domain, title, description, targetScore, strategies, lessonId, sortOrder } = req.body || {};

    if (!title || !domain) {
      return res.status(400).json({ error: "title and domain are required" });
    }

    // Get max sort order if not provided
    let order = sortOrder;
    if (order === undefined || order === null) {
      const lastGoal = await prisma.behaviorPlanGoal.findFirst({
        where: { planId: id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      order = (lastGoal?.sortOrder ?? -1) + 1;
    }

    const goal = await prisma.behaviorPlanGoal.create({
      data: {
        planId: id,
        sortOrder: order,
        domain,
        title,
        description: description || null,
        targetScore: targetScore ?? null,
        strategies: Array.isArray(strategies) ? strategies : [],
        lessonId: lessonId || null,
      },
      include: { lesson: { select: { title: true } } },
    });

    return res.status(201).json(goal);
  } catch (e) {
    console.error("behavior-plans/[id]/goals error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
