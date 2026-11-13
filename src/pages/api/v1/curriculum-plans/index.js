import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { PLAN_TYPES, ageRangeNames, normalizePlanType } from "@/lib/curriculumPlans";
import { PLAN_VIEW_ROLES } from "@/lib/lessonPlanAccess";

/**
 * Curriculum plans (client sheet 10-29, rows 3/4): the Lesson Planner per age
 * range (from Curriculum > Categories) and type.
 * GET  ?centerId=  -> { ageRanges: [name], types: [{value,label}], plans: [{id, ageRange, type, lessons}] }
 * POST { centerId, ageRange, type }  (admin) -> the plan, created when new
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const centerId = String((req.method === "GET" ? req.query.centerId : req.body?.centerId) || "");
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!hasAnyRole(session.user, PLAN_VIEW_ROLES) || !(await hasAccessToCenter(session.user.id, centerId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      const [ageRanges, plans] = await Promise.all([
        ageRangeNames(centerId),
        prisma.curriculumPlan.findMany({
          where: { centerId },
          select: { id: true, ageRange: true, type: true, _count: { select: { cells: true } } },
          orderBy: [{ ageRange: "asc" }, { type: "asc" }],
        }),
      ]);
      return res.status(200).json({
        ageRanges,
        types: PLAN_TYPES,
        plans: plans.map((p) => ({ id: p.id, ageRange: p.ageRange, type: p.type, lessons: p._count.cells })),
      });
    }

    if (req.method === "POST") {
      if (!hasAnyRole(session.user, ["ADMIN"])) return res.status(403).json({ error: "Only admins can change the curriculum" });
      const ageRange = String(req.body?.ageRange || "").trim();
      const type = normalizePlanType(req.body?.type);
      if (!ageRange) return res.status(400).json({ error: "Choose an age group" });
      if (type === null) return res.status(400).json({ error: "Choose a type" });
      const names = await ageRangeNames(centerId);
      const name = names.find((n) => n.toLowerCase() === ageRange.toLowerCase());
      if (!name) return res.status(400).json({ error: "Add this age range under Curriculum > Categories first" });
      const plan = await prisma.curriculumPlan.upsert({
        where: { centerId_ageRange_type: { centerId, ageRange: name, type } },
        create: { centerId, ageRange: name, type },
        update: {},
      });
      return res.status(200).json(plan);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("curriculum plans error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
