import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createApiHandler,
  forbidden,
  unauthorized,
} from "@/lib/api-error";
import {
  ensureObject,
  optionalDate,
  optionalString,
  requiredString,
  optionalNumber,
} from "@/lib/validation";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const userId = optionalString(req.query, "userId");
    const category = optionalString(req.query, "category");
    const from = optionalDate(req.query, "from");
    const to = optionalDate(req.query, "to");

    const where = {};
    if (centerId) where.centerId = centerId;
    if (category) where.category = category;

    if (session.user.role === "TEACHER") {
      where.userId = session.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const logs = await prisma.trainingLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        recordedBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    return res.status(200).json(logs);
  }

  if (!["ADMIN", "TEACHER", "COACH"].includes(session.user.role)) {
    throw forbidden("Only admins, teachers, and coaches can add training logs");
  }

  const body = ensureObject(req.body || {});
  const centerId = requiredString(body, "centerId");
  const topic = requiredString(body, "topic");
  const date = optionalDate(body, "date");
  const hours = optionalNumber(body, "hours", { min: 0.25 });
  if (!date || hours === undefined) {
    return res.status(400).json({
      ok: false,
      message: "hours and date are required",
      error: {
        code: "BAD_REQUEST",
        message: "hours and date are required",
      },
    });
  }

  const description = optionalString(body, "description", { nullable: true });
  const category = optionalString(body, "category", { nullable: true });
  const certificateUrl = optionalString(body, "certificateUrl", { nullable: true });
  const certificateFileName = optionalString(body, "certificateFileName", { nullable: true });
  const targetUserId =
    session.user.role === "TEACHER"
      ? session.user.id
      : optionalString(body, "userId", { nullable: true }) || session.user.id;

  const log = await prisma.trainingLog.create({
    data: {
      userId: targetUserId,
      centerId,
      topic,
      description,
      hours,
      date,
      category: category || "Other",
      certificateUrl,
      certificateFileName,
      recordedById: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(log);
}, { methods: ["GET", "POST"], logLabel: "training-logs error:" });
