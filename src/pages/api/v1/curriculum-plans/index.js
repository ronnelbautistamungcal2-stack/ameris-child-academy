import { accessibleCenterIds, getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { ageRangeNames, normalizePlanType, planTypes } from "@/lib/curriculumPlans";
import { loadCurriculumTypes } from "@/lib/curriculumTypesServer";
import { PLAN_VIEW_ROLES } from "@/lib/lessonPlanAccess";
import { planFollowers } from "@/lib/curriculumSource";

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
      const centerIds = await accessibleCenterIds(session.user.id);
      const [ageRanges, curriculumTypes, plans, rooms] = await Promise.all([
        ageRangeNames(centerId),
        loadCurriculumTypes(),
        prisma.curriculumPlan.findMany({
          where: { centerId },
          select: { id: true, ageRange: true, type: true, dayCount: true, _count: { select: { cells: true } } },
          orderBy: [{ ageRange: "asc" }, { type: "asc" }],
        }),
        // The classrooms (in centers this person can see) that follow each age group.
        prisma.classRoom.findMany({
          where: { curriculumAgeGroupId: { not: null }, ...(centerIds ? { centerId: { in: centerIds } } : {}) },
          select: { name: true, curriculumAgeGroupId: true, center: { select: { name: true } } },
          orderBy: [{ name: "asc" }],
        }),
      ]);
      const multiCenter = new Set(rooms.map((r) => r.center?.name)).size > 1;
      const followers = {};
      for (const r of rooms) {
        const key = r.curriculumAgeGroupId.trim().toLowerCase();
        (followers[key] ||= []).push(multiCenter ? `${r.name} (${r.center?.name})` : r.name);
      }
      // The Ameris curriculum center's planners list the centers that follow
      // each one through their subscription (client sheet 10-29 (12), row 31).
      const isSource = Boolean((await prisma.center.findUnique({ where: { id: centerId }, select: { curriculumSource: true } }))?.curriculumSource);
      return res.status(200).json({
        ...(isSource ? { followingCenters: await planFollowers() } : {}),
        ageRanges,
        types: planTypes(curriculumTypes),
        plans: plans.map((p) => ({ id: p.id, ageRange: p.ageRange, type: p.type, dayCount: p.dayCount, lessons: p._count.cells })),
        followers,
      });
    }

    if (req.method === "POST") {
      if (!hasAnyRole(session.user, ["ADMIN"])) return res.status(403).json({ error: "Only admins can change the curriculum" });
      const ageRange = String(req.body?.ageRange || "").trim();
      const type = normalizePlanType(req.body?.type, await loadCurriculumTypes());
      if (!ageRange) return res.status(400).json({ error: "Choose an age group" });
      if (type === null) return res.status(400).json({ error: "Choose a type" });
      const names = await ageRangeNames(centerId);
      const name = names.find((n) => n.toLowerCase() === ageRange.toLowerCase());
      if (!name) return res.status(400).json({ error: "Add this age range under Curriculum > Categories first" });
      // No new "All types" planners (client sheet 10-29 (11), row 64); old ones still open.
      if (type === "" && !(await prisma.curriculumPlan.findUnique({ where: { centerId_ageRange_type: { centerId, ageRange: name, type } } }))) {
        return res.status(400).json({ error: "Choose a type" });
      }
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
