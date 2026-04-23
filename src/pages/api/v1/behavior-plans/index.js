import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  buildTeacherChildWhere,
  teacherCanAccessChild,
} from "@/lib/teacherScope";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("behavior-plans error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, childId, status } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (childId) where.childId = childId;
  if (status) where.status = status;

  if (session.user.role === "TEACHER") {
    where.child = await buildTeacherChildWhere(session.user.id, centerId);
  }

  const plans = await prisma.behaviorPlan.findMany({
    where,
    include: {
      goals: { orderBy: { sortOrder: "asc" } },
      child: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(plans);
}

async function handlePost(req, res, session) {
  const { childId, centerId, title, description, targetDomains, startDate, endDate, reviewDate, notes, goals } = req.body || {};

  if (!childId || !centerId || !title) {
    return res.status(400).json({ error: "childId, centerId, and title are required" });
  }

  // Verify access to child
  if (session.user.role === "TEACHER") {
    const count = await teacherCanAccessChild(session.user.id, childId);
    if (!count) return res.status(403).json({ error: "You don't have access to this child" });
  }

  const plan = await prisma.behaviorPlan.create({
    data: {
      childId,
      centerId,
      title,
      description: description || null,
      targetDomains: Array.isArray(targetDomains) ? targetDomains : [],
      createdById: session.user.id,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      reviewDate: reviewDate ? new Date(reviewDate) : null,
      notes: notes || null,
      goals: Array.isArray(goals) && goals.length
        ? {
            create: goals.map((g, i) => ({
              sortOrder: g.sortOrder ?? i,
              domain: g.domain || "cognitive",
              title: g.title || "Goal",
              description: g.description || null,
              targetScore: g.targetScore ?? null,
              strategies: Array.isArray(g.strategies) ? g.strategies : [],
              lessonId: g.lessonId || null,
            })),
          }
        : undefined,
    },
    include: {
      goals: { orderBy: { sortOrder: "asc" } },
      child: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
    },
  });

  return res.status(201).json(plan);
}
