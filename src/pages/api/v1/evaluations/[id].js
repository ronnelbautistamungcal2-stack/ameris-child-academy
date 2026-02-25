import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "PUT") return handlePut(req, res, session);
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("evaluations/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { id } = req.query;
  const evaluation = await prisma.teacherEvaluation.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
  });

  if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });

  if (session.user.role === "TEACHER" && evaluation.teacherId !== session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.status(200).json(evaluation);
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can update evaluations" });
  }

  const { id } = req.query;
  const evaluation = await prisma.teacherEvaluation.findUnique({ where: { id } });
  if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });

  const { status, overallScore, categories, strengths, areasForImprovement, goals, notes } = req.body || {};
  const data = {};
  if (status !== undefined) data.status = status;
  if (overallScore !== undefined) data.overallScore = overallScore ? parseFloat(overallScore) : null;
  if (categories !== undefined) data.categories = categories;
  if (strengths !== undefined) data.strengths = strengths;
  if (areasForImprovement !== undefined) data.areasForImprovement = areasForImprovement;
  if (goals !== undefined) data.goals = goals;
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.teacherEvaluation.update({
    where: { id },
    data,
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
  });

  return res.status(200).json(updated);
}
