import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  buildTeacherChildWhere,
  teacherCanAccessChild,
} from "@/lib/teacherScope";
import { emitNotification } from "@/lib/socket";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") {
      if (session.user.role === "PARENT") return res.status(403).json({ error: "Forbidden" });
      return handlePost(req, res, session);
    }
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

  // Parents can only see plans for their linked children
  if (session.user.role === "PARENT") {
    const linkedChildren = await prisma.child.findMany({
      where: {
        OR: [
          { parentId: session.user.id },
          { guardians: { some: { guardianId: session.user.id } } },
        ],
      },
      select: { id: true },
    });
    const linkedIds = linkedChildren.map((c) => c.id);
    if (linkedIds.length === 0) return res.status(200).json([]);
    where.childId = childId && linkedIds.includes(childId) ? childId : { in: linkedIds };
  }

  const plans = await prisma.behaviorPlan.findMany({
    where,
    include: {
      goals: { orderBy: { sortOrder: "asc" } },
      child: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(plans);
}

async function handlePost(req, res, session) {
  const {
    childId, centerId, title, description,
    teacherTactics, parentTactics, coachTactics, disciplinaryAction,
    startDate, endDate, reviewDate, notes, goals,
  } = req.body || {};

  if (!childId || !centerId || !title) {
    return res.status(400).json({ error: "childId, centerId, and title are required" });
  }

  if (session.user.role === "TEACHER") {
    const count = await teacherCanAccessChild(session.user.id, childId);
    if (!count) return res.status(403).json({ error: "You don't have access to this child" });
  }

  // Find parent linked to child to notify them
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      parentId: true,
      guardians: { select: { guardianId: true } },
      firstName: true,
      lastName: true,
    },
  });

  const plan = await prisma.behaviorPlan.create({
    data: {
      childId,
      centerId,
      title,
      description: description || null,
      teacherTactics: teacherTactics || null,
      parentTactics: parentTactics || null,
      coachTactics: coachTactics || null,
      disciplinaryAction: disciplinaryAction || null,
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
      closedBy: { select: { name: true } },
    },
  });

  // Create pending-approval notification for parent(s)
  const parentIds = [
    ...(child?.parentId ? [child.parentId] : []),
    ...(child?.guardians?.map((g) => g.guardianId) || []),
  ].filter(Boolean);

  if (parentIds.length > 0) {
    const childName = `${child?.firstName || ""} ${child?.lastName || ""}`.trim();
    const parentNotifications = parentIds.map((userId) => ({
      recipientId: userId,
      type: "ACTIVITY_UPDATE",
      title: "Individual Progress Plan — Approval Required",
      body: `An Individual Progress Plan titled "${title}" has been created for ${childName}. Please review and approve it.`,
      link: `/parent/children?childId=${childId}&tab=progress_plan`,
      metadata: { planId: plan.id, childId },
    }));
    await prisma.notification.createMany({ data: parentNotifications, skipDuplicates: true }).catch(() => {});
    parentNotifications.forEach((n) => emitNotification(n.recipientId, n));
  }

  return res.status(201).json(plan);
}
