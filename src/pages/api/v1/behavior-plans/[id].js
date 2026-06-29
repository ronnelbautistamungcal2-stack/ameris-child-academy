import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isChildLinkedToParent } from "@/lib/child-parent-links";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "PARENT"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Plan id is required" });

    if (req.method === "GET") return handleGet(req, res, session, id);
    if (req.method === "PUT") return handlePut(req, res, session, id);
    if (req.method === "DELETE") return handleDelete(req, res, session, id);
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("behavior-plans/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session, id) {
  const plan = await prisma.behaviorPlan.findUnique({
    where: { id },
    include: {
      goals: {
        orderBy: { sortOrder: "asc" },
        include: { lesson: { select: { title: true } } },
      },
      child: {
        select: {
          firstName: true,
          lastName: true,
          parentId: true,
          guardians: { select: { guardianId: true } },
        },
      },
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });

  if (!plan) return res.status(404).json({ error: "Plan not found" });

  if (
    session.user.role === "PARENT" &&
    !isChildLinkedToParent(plan.child, session.user.id)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.status(200).json(plan);
}

async function handlePut(req, res, session, id) {
  if (session.user.role === "PARENT") {
    return res.status(403).json({ error: "Parents cannot edit behavior plans" });
  }

  const plan = await prisma.behaviorPlan.findUnique({ where: { id } });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const {
    title, description, status,
    teacherTactics, parentTactics, coachTactics, disciplinaryAction,
    startDate, endDate, reviewDate, notes, close,
  } = req.body || {};

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (teacherTactics !== undefined) data.teacherTactics = teacherTactics;
  if (parentTactics !== undefined) data.parentTactics = parentTactics;
  if (coachTactics !== undefined) data.coachTactics = coachTactics;
  if (disciplinaryAction !== undefined) data.disciplinaryAction = disciplinaryAction;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (reviewDate !== undefined) data.reviewDate = reviewDate ? new Date(reviewDate) : null;
  if (notes !== undefined) data.notes = notes;

  // Close the plan
  if (close === true) {
    data.status = "CLOSED";
    data.closedAt = new Date();
    data.closedById = session.user.id;
  } else if (close === false && plan.status === "CLOSED") {
    // Reopen
    data.status = "ACTIVE";
    data.closedAt = null;
    data.closedById = null;
  }

  const updated = await prisma.behaviorPlan.update({
    where: { id },
    data,
    include: {
      goals: { orderBy: { sortOrder: "asc" } },
      child: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session, id) {
  if (session.user.role === "PARENT") {
    return res.status(403).json({ error: "Parents cannot delete behavior plans" });
  }

  const plan = await prisma.behaviorPlan.findUnique({ where: { id } });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const updated = await prisma.behaviorPlan.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json(updated);
}
