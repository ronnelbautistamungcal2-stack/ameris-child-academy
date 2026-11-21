import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { planAccess } from "@/lib/curriculumPlans";

/**
 * DELETE /api/v1/curriculum-plans/:id?centerId=  (admin)
 * Deletes a planner with no lessons in it (Planners list, client 2026-11-21).
 * A planner with lessons is refused, so a filled curriculum is never lost by
 * accident.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "DELETE") {
      res.setHeader("Allow", ["DELETE"]);
      return res.status(405).end();
    }
    const access = await planAccess(session.user, req.query.centerId, req.query.id, { admin: true });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const cells = await prisma.lessonPlanCell.count({ where: { planId: access.plan.id } });
    if (cells > 0) return res.status(409).json({ error: "This planner has lessons in it, so it can't be deleted" });
    await prisma.curriculumPlan.delete({ where: { id: access.plan.id } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("curriculum plan delete error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
