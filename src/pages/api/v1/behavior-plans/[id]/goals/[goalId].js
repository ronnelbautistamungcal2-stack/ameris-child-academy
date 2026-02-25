import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { goalId } = req.query;
    if (!goalId) return res.status(400).json({ error: "goalId is required" });

    if (req.method !== "PUT") {
      res.setHeader("Allow", ["PUT"]);
      return res.status(405).end();
    }

    const goal = await prisma.behaviorPlanGoal.findUnique({ where: { id: goalId } });
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    const { status, currentScore, notes, title, description, targetScore, strategies, domain } = req.body || {};

    const data = {};
    if (status !== undefined) data.status = status;
    if (currentScore !== undefined) data.currentScore = currentScore;
    if (notes !== undefined) data.notes = notes;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (targetScore !== undefined) data.targetScore = targetScore;
    if (strategies !== undefined) data.strategies = strategies;
    if (domain !== undefined) data.domain = domain;

    // Auto-set achievedAt when goal is met
    if (status === "MET" && !goal.achievedAt) {
      data.achievedAt = new Date();
    }

    const updated = await prisma.behaviorPlanGoal.update({
      where: { id: goalId },
      data,
      include: { lesson: { select: { title: true } } },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("behavior-plans/[id]/goals/[goalId] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
