import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  badRequest,
  createApiHandler,
  forbidden,
  unauthorized,
} from "@/lib/api-error";
import {
  ensureObject,
  optionalDate,
  optionalEnum,
  optionalNumber,
  optionalString,
  requiredString,
} from "@/lib/validation";
import { userRoles } from "@/lib/roles";

const EVALUATION_STATUSES = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED"];

function endOfDay(date) {
  if (!date) return undefined;
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function periodLabel(start, end, fallback) {
  if (fallback) return fallback;
  if (!start && !end) return "";
  const startLabel = start ? start.toISOString().slice(0, 10) : "Open";
  const endLabel = end ? end.toISOString().slice(0, 10) : "Open";
  return `${startLabel} to ${endLabel}`;
}

function validateRangeOrder(start, end, label) {
  if (start && end && end < start) {
    throw badRequest(`${label} end date must be on or after the start date`);
  }
}

function validatePeriodRange(start, end) {
  if ((start && !end) || (!start && end)) {
    throw badRequest("Evaluation period start and end dates are both required");
  }
  validateRangeOrder(start, end, "Evaluation period");
}

function buildEvaluationHistoryFilter(from, to) {
  if (!from && !to) return undefined;

  const scheduledPeriodFilters = [
    { periodStart: { not: null } },
    { periodEnd: { not: null } },
  ];

  if (from) scheduledPeriodFilters.push({ periodEnd: { gte: from } });
  if (to) scheduledPeriodFilters.push({ periodStart: { lte: to } });

  return {
    OR: [
      { AND: scheduledPeriodFilters },
      {
        AND: [
          { periodStart: null },
          { periodEnd: null },
          {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          },
        ],
      },
    ],
  };
}

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (
    req.method === "GET" &&
    !["ADMIN", "TEACHER", "OTHER_STAFF", "COACH"].includes(session.user.role)
  ) {
    throw forbidden("Only employees can access evaluations");
  }

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const teacherId = optionalString(req.query, "teacherId");
    const period = optionalString(req.query, "period");
    const status = optionalEnum(req.query, "status", EVALUATION_STATUSES);
    const from = optionalDate(req.query, "from");
    const to = endOfDay(optionalDate(req.query, "to"));
    validateRangeOrder(from, to, "Filter");

    if (centerId && session.user.role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    const where = {};
    if (centerId) where.centerId = centerId;
    if (period) where.period = period;
    if (status) where.status = status;
    const historyFilter = buildEvaluationHistoryFilter(from, to);
    if (historyFilter) where.AND = [historyFilter];

    if (session.user.role !== "ADMIN") {
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
  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) throw forbidden();
  }
  const teacherId = requiredString(body, "teacherId");
  const periodStart = optionalDate(body, "periodStart", { nullable: true });
  const periodEnd = optionalDate(body, "periodEnd", { nullable: true });
  validatePeriodRange(periodStart, periodEnd);
  const period = periodLabel(periodStart, periodEnd, optionalString(body, "period"));
  if (!period) {
    throw badRequest("Evaluation period is required");
  }
  const overallScore = optionalNumber(body, "overallScore", { min: 0 });
  const categories = ensureObject(body.categories ?? {}, "categories");
  const strengths = optionalString(body, "strengths", { nullable: true });
  const areasForImprovement = optionalString(body, "areasForImprovement", { nullable: true });
  const goals = optionalString(body, "goals", { nullable: true });
  const notes = optionalString(body, "notes", { nullable: true });
  const targetUser = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { role: true, roles: true },
  });
  const targetRoles = userRoles(targetUser);
  if (!targetRoles.some((role) => ["TEACHER", "OTHER_STAFF", "COACH"].includes(role))) {
    throw badRequest("Evaluations can only be created for staff members");
  }

  const evaluation = await prisma.teacherEvaluation.create({
    data: {
      teacherId,
      centerId,
      evaluatorId: session.user.id,
      period,
      periodStart,
      periodEnd,
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
