import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createApiHandler,
  forbidden,
  unauthorized,
} from "@/lib/api-error";
import { ensureObject, optionalDate, optionalNumber, optionalString, requiredString } from "@/lib/validation";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const teacherId = optionalString(req.query, "teacherId");
    const period = optionalString(req.query, "period");
    const status = optionalString(req.query, "status");
    const from = optionalDate(req.query, "from");
    const to = optionalDate(req.query, "to");

    const where = {};
    if (centerId) where.centerId = centerId;
    if (period) where.period = period;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

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

  if (session.user.role !== "ADMIN") {
    throw forbidden("Only admins can create evaluations");
  }

  const body = ensureObject(req.body || {});
  const centerId = requiredString(body, "centerId");
  const teacherId = requiredString(body, "teacherId");
  const period = requiredString(body, "period");
  const overallScore = optionalNumber(body, "overallScore", { min: 0 });
  const categories = body.categories ?? {};
  const strengths = optionalString(body, "strengths", { nullable: true });
  const areasForImprovement = optionalString(body, "areasForImprovement", { nullable: true });
  const goals = optionalString(body, "goals", { nullable: true });
  const notes = optionalString(body, "notes", { nullable: true });

  const evaluation = await prisma.teacherEvaluation.create({
    data: {
      teacherId,
      centerId,
      evaluatorId: session.user.id,
      period,
      overallScore: overallScore ?? null,
      categories,
      strengths,
      areasForImprovement,
      goals,
      notes,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json(evaluation);
}, { methods: ["GET", "POST"], logLabel: "evaluations error:" });
