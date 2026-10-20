import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { displayName, nextReviewDate, parseIppInput } from "@/lib/ipp";
import { loadIppForUser } from "@/lib/ippAccess";

const INCLUDE = {
  child: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      photoUrl: true,
      classRoom: {
        select: { name: true, teachers: { select: { teacher: { select: { name: true, email: true } } } } },
      },
      parent: { select: { name: true, email: true } },
      guardians: { where: { isPrimary: true }, select: { guardian: { select: { name: true, email: true } } } },
    },
  },
  createdBy: { select: { name: true, email: true } },
  goals: {
    orderBy: { sortOrder: "asc" },
    include: { ippStrategies: { orderBy: { sortOrder: "asc" } } },
  },
  documents: { orderBy: { createdAt: "asc" } },
  logs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { goal: { select: { id: true, title: true, domain: true } } } },
};

function serialize(plan, access) {
  const child = plan.child;
  const parent = child.guardians?.[0]?.guardian || child.parent;
  return {
    id: plan.id,
    canManage: access.canManage,
    canLog: access.canLog,
    child: {
      id: child.id,
      name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
      birthDate: child.birthDate,
      photoUrl: child.photoUrl,
      classroom: child.classRoom?.name || "",
      teacher: (child.classRoom?.teachers || []).map((t) => displayName(t.teacher)).join(", "),
      parent: parent ? displayName(parent) : "",
    },
    startDate: plan.startDate,
    reviewSchedule: plan.reviewSchedule || "",
    nextReviewDate: nextReviewDate(plan.startDate, plan.reviewSchedule),
    status: plan.status,
    planType: plan.planType || "",
    focusArea: plan.focusArea || "",
    purpose: plan.description || "",
    measurableOutcomes: plan.measurableOutcomes || "",
    // Parents and teachers do not see the disciplinary action.
    disciplinaryAction: access.canManage ? plan.disciplinaryAction || "" : undefined,
    champion: displayName(plan.createdBy),
    updatedAt: plan.updatedAt,
    updatedBy: plan.updatedByName || displayName(plan.createdBy),
    goals: plan.goals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      targetDate: g.targetDate,
      progress: g.progress,
      strategies: g.ippStrategies.map((s) => ({
        id: s.id,
        kind: s.kind,
        text: s.text,
        role: s.role || "",
        frequency: s.frequency || "",
        notes: s.notes || "",
        documents: Array.isArray(s.documents) ? s.documents : [],
      })),
    })),
    documents: plan.documents.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      fileType: d.fileType || "",
      notes: d.notes || "",
      uploadedBy: d.uploadedByName,
      createdAt: d.createdAt,
    })),
    logs: plan.logs.map((l) => ({
      id: l.id,
      date: l.date.toISOString().slice(0, 10),
      goalId: l.goalId,
      goal: l.goal ? l.goal.domain || l.goal.title : "",
      goalTitle: l.goal?.title || "",
      tactic: l.tactic,
      tacticDetail: l.tacticDetail || "",
      observation: l.observation || "",
      enteredBy: l.enteredByName,
    })),
  };
}

/**
 * GET /api/v1/ipp/:id   The whole plan for the plan page.
 * PUT /api/v1/ipp/:id   Edit Plan: replaces the plan fields and its goals,
 *                       strategies and supports (managers only).
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;
    const access = await loadIppForUser(user, req.query.id, INCLUDE);
    if (access.error) return res.status(access.status).json({ error: access.error });

    if (req.method === "GET") return res.status(200).json(serialize(access.plan, access));

    if (req.method === "PUT") {
      if (!access.canManage) return res.status(403).json({ error: "Only Student Support, coaches and admins can edit progress plans" });
      const parsed = parseIppInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const plan = access.plan;
      const existingIds = new Set(plan.goals.map((g) => g.id));
      const keep = parsed.goals.filter((g) => g.id && existingIds.has(g.id)).map((g) => g.id);
      const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });

      await prisma.$transaction(async (tx) => {
        await tx.behaviorPlan.update({ where: { id: plan.id }, data: { ...parsed.plan, updatedByName: displayName(me) } });
        // Goals left out of the form are removed; their log entries stay with no goal.
        await tx.behaviorPlanGoal.deleteMany({ where: { planId: plan.id, id: { notIn: keep } } });
        for (const { id, strategies, ...goal } of parsed.goals) {
          if (id && existingIds.has(id)) {
            await tx.behaviorPlanGoal.update({ where: { id }, data: goal });
            await tx.behaviorPlanStrategy.deleteMany({ where: { goalId: id } });
            if (strategies.length) await tx.behaviorPlanStrategy.createMany({ data: strategies.map((s) => ({ ...s, goalId: id })) });
          } else {
            await tx.behaviorPlanGoal.create({ data: { ...goal, planId: plan.id, ippStrategies: { create: strategies } } });
          }
        }
      });
      const fresh = await loadIppForUser(user, plan.id, INCLUDE);
      return res.status(200).json(serialize(fresh.plan, fresh));
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("ipp/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
