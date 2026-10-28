import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CURRENT_IPP_STATUSES, displayName, nextReviewDate, parseIppInput } from "@/lib/ipp";
import { canManageChild, canManageIpp, ippScope } from "@/lib/ippAccess";

function childName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

/**
 * GET  /api/v1/ipp?view=current|all   Individual Progress Plans the user can see.
 * POST /api/v1/ipp  { childId, ...plan, goals: [...] }   Student Support, coach, admin.
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const scope = await ippScope(user);
      if (!scope) return res.status(403).json({ error: "Forbidden" });
      const view = req.query.view === "all" ? "all" : "current";
      const where = {
        ...scope,
        ...(req.query.childId ? { childId: String(req.query.childId) } : {}),
        ...(view === "current" ? { status: { in: CURRENT_IPP_STATUSES } } : {}),
      };
      const plans = await prisma.behaviorPlan.findMany({
        where,
        include: {
          child: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { name: true, email: true } },
          _count: { select: { goals: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      return res.status(200).json({
        canManage: canManageIpp(user),
        plans: plans.map((p) => ({
          id: p.id,
          childId: p.childId,
          childName: childName(p.child),
          planType: p.planType || "",
          focusArea: p.focusArea || "",
          startDate: p.startDate,
          reviewSchedule: p.reviewSchedule || "",
          nextReviewDate: nextReviewDate(p.startDate, p.reviewSchedule),
          status: p.status,
          goals: p._count.goals,
          updatedAt: p.updatedAt,
          updatedBy: p.updatedByName || displayName(p.createdBy),
        })),
      });
    }

    if (req.method === "POST") {
      if (!canManageIpp(user)) return res.status(403).json({ error: "Only Student Support, coaches and admins can create progress plans" });
      const childId = String(req.body?.childId || "");
      if (!childId) return res.status(400).json({ error: "Choose a child" });
      if (!(await canManageChild(user, childId))) return res.status(403).json({ error: "You cannot create a plan for this child" });
      const parsed = parseIppInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const child = await prisma.child.findUnique({ where: { id: childId }, select: { centerId: true } });
      const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
      const plan = await prisma.behaviorPlan.create({
        data: {
          ...parsed.plan,
          title: `${parsed.plan.focusArea || parsed.plan.planType || "Individual"} Progress Plan`,
          childId,
          centerId: child.centerId,
          createdById: user.id,
          updatedByName: displayName(me),
          reviewedAt: new Date(),
          goals: {
            create: parsed.goals.map(({ id, strategies, ...goal }) => ({
              ...goal,
              ippStrategies: { create: strategies },
            })),
          },
        },
        select: { id: true },
      });
      return res.status(201).json(plan);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("ipp error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
