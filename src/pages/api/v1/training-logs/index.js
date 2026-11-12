import { centerIdFilter, getSession, hasAccessToCenter } from "@/lib/auth";
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
import { isEmployeeRole, isSelfServiceEmployeeRole } from "@/lib/roles";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (!isEmployeeRole(session.user.role)) {
    throw forbidden("Only employees can access training logs");
  }

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const userId = optionalString(req.query, "userId");
    const category = optionalString(req.query, "category");
    const from = optionalDate(req.query, "from");
    const to = optionalDate(req.query, "to");

    if (centerId) {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    // No center chosen: only the centers this user can reach, never every center.
    const where = { centerId: await centerIdFilter(session.user.id, centerId) };
    if (category) where.category = category;

    if (isSelfServiceEmployeeRole(session.user.role)) {
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

  const body = ensureObject(req.body || {});
  const centerId = requiredString(body, "centerId");
  const allowed = await hasAccessToCenter(session.user.id, centerId);
  if (!allowed) throw forbidden();
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
  const performedBy = optionalString(body, "performedBy", { nullable: true });
  const category = optionalString(body, "category", { nullable: true });
  const certificateUrl = optionalString(body, "certificateUrl", { nullable: true });
  const certificateFileName = optionalString(body, "certificateFileName", { nullable: true });
  // Record Training: non-interactive / interactive hours and the source.
  const nonInteractiveHours = optionalNumber(body, "nonInteractiveHours", { min: 0, nullable: true });
  const interactiveHours = optionalNumber(body, "interactiveHours", { min: 0, nullable: true });
  const source = optionalString(body, "source", { nullable: true });
  const rawUserIds = Array.isArray(body.userIds) ? body.userIds : [];
  const normalizedUserIds = rawUserIds
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const fallbackUserId = optionalString(body, "userId", { nullable: true });
  const targetUserIds =
    isSelfServiceEmployeeRole(session.user.role)
      ? [session.user.id]
      : normalizedUserIds.length
        ? [...new Set(normalizedUserIds)]
        : [fallbackUserId || session.user.id];

  // Record Training can apply the session to a pathway's training: each
  // attendee gets that training marked completed, so it counts toward their
  // pathway percentage (client request 2026-10-29).
  const trainingItemId = optionalString(body, "trainingItemId", { nullable: true });
  const trainingItem = trainingItemId
    ? await prisma.trainingItem.findFirst({ where: { id: trainingItemId, centerId }, select: { id: true } })
    : null;
  if (trainingItemId && !trainingItem) {
    return res.status(400).json({ ok: false, message: "That pathway training was not found", error: { code: "BAD_REQUEST", message: "That pathway training was not found" } });
  }

  const createdLogs = await prisma.$transaction(
    targetUserIds.map((targetUserId) =>
      prisma.trainingLog.create({
        data: {
          userId: targetUserId,
          centerId,
          topic,
          description,
          performedBy,
          hours,
          date,
          category: category || "Other",
          certificateUrl,
          certificateFileName,
          nonInteractiveHours,
          interactiveHours,
          source,
          recordedById: session.user.id,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ),
  );

  if (trainingItem) {
    const completedAt = date || new Date();
    await prisma.$transaction(
      targetUserIds.map((userId) =>
        prisma.trainingProgress.upsert({
          where: { userId_trainingItemId: { userId, trainingItemId: trainingItem.id } },
          update: { status: "COMPLETED", completedAt, acknowledgedAt: completedAt, observationStatus: "COMPLETED", handsOnStatus: "COMPLETED" },
          create: { userId, trainingItemId: trainingItem.id, status: "COMPLETED", startedAt: completedAt, completedAt, acknowledgedAt: completedAt, observationStatus: "COMPLETED", handsOnStatus: "COMPLETED", materialsViewed: [] },
        }),
      ),
    );
  }

  return res.status(201).json(createdLogs.length === 1 ? createdLogs[0] : createdLogs);
}, { methods: ["GET", "POST"], logLabel: "training-logs error:" });
