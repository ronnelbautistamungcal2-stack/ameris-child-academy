import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { childStatus, isLevel, statusDistribution } from "@/lib/sop";
import { SOP_ROLES, canUseChild, loadChildSteps, saveLevels } from "@/lib/sopServer";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

const CHILD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  photoUrl: true,
  centerId: true,
  classRoomId: true,
  classRoom: { select: { name: true } },
  parentId: true,
  guardians: { select: { guardianId: true } },
};

function summary(steps, birthDate) {
  const goals = steps.filter((s) => s.active).map((s) => ({ step: s, level: s.level || "NOT_STARTED" }));
  const byCategory = {};
  for (const g of goals) (byCategory[g.step.category] ||= []).push(g);
  return {
    status: childStatus(goals, birthDate),
    activeGoals: goals.length,
    categories: Object.fromEntries(
      Object.entries(byCategory).map(([name, list]) => [name, { activeGoals: list.length, distribution: statusDistribution(list, birthDate) }]),
    ),
  };
}

/**
 * GET /api/v1/sop/:childId
 *     The child and every step in their center with the child's level, notes
 *     and whether it is an active goal, plus status summaries.
 * PUT /api/v1/sop/:childId  { mode: "assessment" | "tracking", levels: [{ stepId, level, notes? }], generate? }
 *     Initial Developmental Assessment (Save / Generate Active Goals) or the
 *     Progression Tracking sliders. Parents may only save "tracking" levels
 *     for their child's General-category goals (Student Performance Report).
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;
    const child = await prisma.child.findUnique({ where: { id: String(req.query.childId) }, select: CHILD_SELECT });
    if (!hasAnyRole(user, SOP_ROLES)) {
      if (!hasAnyRole(user, ["PARENT"]) || !child || !isChildLinkedToParent(child, user.id)) return res.status(403).json({ error: "Forbidden" });
      return parentSave(req, res, child, user);
    }
    if (!child || !(await canUseChild(user, child))) return res.status(404).json({ error: "Child not found" });

    if (req.method === "PUT") {
      const mode = req.body?.mode === "tracking" ? "tracking" : "assessment";
      const levels = Array.isArray(req.body?.levels) ? req.body.levels : [];
      if (levels.some((l) => !l?.stepId || !isLevel(l.level))) return res.status(400).json({ error: "Each level needs a step and one of Not Started, Exposure, Competency or Mastery" });
      if (levels.length > 1000) return res.status(400).json({ error: "Too many steps in one save" });
      const stepIds = new Set(
        (await prisma.lesson.findMany({ where: { centerId: child.centerId, isStep: true, id: { in: levels.map((l) => String(l.stepId)) } }, select: { id: true } })).map((s) => s.id),
      );
      if (levels.some((l) => !stepIds.has(String(l.stepId)))) return res.status(400).json({ error: "That step is not in this child's center" });
      await saveLevels(child, levels.map((l) => ({ ...l, stepId: String(l.stepId) })), user, { mode, generate: Boolean(req.body?.generate) });
    } else if (req.method !== "GET") {
      res.setHeader("Allow", ["GET", "PUT"]);
      return res.status(405).end();
    }

    const steps = await loadChildSteps(child);
    return res.status(200).json({
      child: {
        id: child.id,
        name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
        birthDate: child.birthDate,
        photoUrl: child.photoUrl,
        classroom: child.classRoom?.name || "",
      },
      steps,
      ...summary(steps, child.birthDate),
    });
  } catch (e) {
    console.error("sop child error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// A parent marks off their child's General-category goals.
async function parentSave(req, res, child, user) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }
  const levels = Array.isArray(req.body?.levels) ? req.body.levels : [];
  if (!levels.length || levels.length > 200 || levels.some((l) => !l?.stepId || !isLevel(l.level))) {
    return res.status(400).json({ error: "Each level needs a step and one of Not Started, Exposure, Competency or Mastery" });
  }
  const steps = await prisma.lesson.findMany({
    where: { centerId: child.centerId, isStep: true, id: { in: levels.map((l) => String(l.stepId)) } },
    select: { id: true, category: { select: { name: true } } },
  });
  const general = new Set(steps.filter((s) => (s.category?.name || "General") === "General").map((s) => s.id));
  if (levels.some((l) => !general.has(String(l.stepId)))) {
    return res.status(403).json({ error: "Parents can only mark off goals in the General category" });
  }
  await saveLevels(child, levels.map((l) => ({ stepId: String(l.stepId), level: l.level })), user, { mode: "tracking" });
  return res.status(200).json({ saved: levels.length });
}
