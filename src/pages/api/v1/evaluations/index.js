import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (e) {
    console.error("evaluations error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, teacherId, period, status } = req.query;

  const where = {};
  if (centerId) where.centerId = centerId;
  if (period) where.period = period;
  if (status) where.status = status;

  if (session.user.role === "TEACHER") {
    where.teacherId = session.user.id;
  } else if (teacherId) {
    where.teacherId = teacherId;
  }

  const evaluations = await prisma.teacherEvaluation.findMany({
    where,
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.status(200).json(evaluations);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can create evaluations" });
  }

  const { centerId, teacherId, period, overallScore, categories, strengths, areasForImprovement, goals, notes } = req.body || {};
  if (!centerId || !teacherId || !period) {
    return res.status(400).json({ error: "centerId, teacherId, and period are required" });
  }

  const evaluation = await prisma.teacherEvaluation.create({
    data: {
      teacherId,
      centerId,
      evaluatorId: session.user.id,
      period,
      overallScore: overallScore ? parseFloat(overallScore) : null,
      categories: categories || {},
      strengths: strengths || null,
      areasForImprovement: areasForImprovement || null,
      goals: goals || null,
      notes: notes || null,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json(evaluation);
}
