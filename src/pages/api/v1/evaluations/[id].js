import { getSession } from "@/lib/auth";
import { badRequest } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import {
  ensureObject,
  optionalDate,
  optionalEnum,
  optionalNumber,
  optionalString,
} from "@/lib/validation";

const EVALUATION_STATUSES = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED"];

function periodLabel(start, end, fallback) {
  if (fallback) return fallback;
  if (!start && !end) return "";
  const startLabel = start ? new Date(start).toISOString().slice(0, 10) : "Open";
  const endLabel = end ? new Date(end).toISOString().slice(0, 10) : "Open";
  return `${startLabel} to ${endLabel}`;
}

function validatePeriodRange(start, end) {
  if ((start && !end) || (!start && end)) {
    throw badRequest("Evaluation period start and end dates are both required");
  }
  if (start && end && end < start) {
    throw badRequest("Evaluation period end date must be on or after the start date");
  }
}

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
  if (!["ADMIN", "TEACHER", "OTHER_STAFF", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const evaluation = await prisma.teacherEvaluation.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
    },
  });

  if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });

  if (session.user.role !== "ADMIN" && evaluation.teacherId !== session.user.id) {
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

  const body = ensureObject(req.body || {});
  const status = optionalEnum(body, "status", EVALUATION_STATUSES);
  const overallScore = optionalNumber(body, "overallScore", {
    min: 0,
    nullable: true,
  });
  const categories =
    body.categories !== undefined
      ? ensureObject(body.categories, "categories")
      : undefined;
  const strengths = optionalString(body, "strengths", { nullable: true });
  const areasForImprovement = optionalString(body, "areasForImprovement", {
    nullable: true,
  });
  const goals = optionalString(body, "goals", { nullable: true });
  const notes = optionalString(body, "notes", { nullable: true });
  const periodStart = optionalDate(body, "periodStart", { nullable: true });
  const periodEnd = optionalDate(body, "periodEnd", { nullable: true });
  const period = optionalString(body, "period");

  const data = {};
  if (status !== undefined) data.status = status;
  if (overallScore !== undefined) data.overallScore = overallScore;
  if (categories !== undefined) data.categories = categories;
  if (strengths !== undefined) data.strengths = strengths;
  if (areasForImprovement !== undefined) data.areasForImprovement = areasForImprovement;
  if (goals !== undefined) data.goals = goals;
  if (notes !== undefined) data.notes = notes;

  const hasPeriodStartChange = Object.prototype.hasOwnProperty.call(body, "periodStart");
  const hasPeriodEndChange = Object.prototype.hasOwnProperty.call(body, "periodEnd");

  if (hasPeriodStartChange || hasPeriodEndChange || period !== undefined) {
    const nextPeriodStart = hasPeriodStartChange ? periodStart : evaluation.periodStart;
    const nextPeriodEnd = hasPeriodEndChange ? periodEnd : evaluation.periodEnd;

    if (hasPeriodStartChange || hasPeriodEndChange) {
      validatePeriodRange(nextPeriodStart, nextPeriodEnd);
      data.periodStart = nextPeriodStart;
      data.periodEnd = nextPeriodEnd;
    }

    const nextPeriod = period !== undefined ? period : periodLabel(nextPeriodStart, nextPeriodEnd);
    if (!nextPeriod) {
      throw badRequest("Evaluation period is required");
    }
    data.period = nextPeriod;
  }

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
