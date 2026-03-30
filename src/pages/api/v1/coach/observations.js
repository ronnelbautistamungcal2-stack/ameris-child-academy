import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, forbidden, notFound, unauthorized } from "@/lib/api-error";
import {
  ensureObject,
  optionalDate,
  optionalNumber,
  optionalString,
  requiredString,
} from "@/lib/validation";

const OBSERVATION_TYPES = ["CAMERA", "IN_CLASS"];

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (!["ADMIN", "COACH"].includes(session.user.role)) throw forbidden();

  const role = session.user.role;

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const type = optionalString(req.query, "type");
    const teacherId = optionalString(req.query, "teacherId");
    if (centerId && role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    const where = {};
    if (centerId) where.centerId = centerId;
    if (type && OBSERVATION_TYPES.includes(type)) where.type = type;
    if (teacherId) where.teacherId = teacherId;

    const observations = await prisma.coachObservation.findMany({
      where,
      select: {
        id: true,
        type: true,
        date: true,
        duration: true,
        score: true,
        strengths: true,
        improvements: true,
        actionItems: true,
        notes: true,
        createdAt: true,
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return res.status(200).json(observations);
  }

  if (req.method === "POST") {
    const body = ensureObject(req.body || {});
    const centerId = requiredString(body, "centerId");
    const teacherId = requiredString(body, "teacherId");
    const type = requiredString(body, "type");
    if (!OBSERVATION_TYPES.includes(type)) {
      return res.status(400).json({
        ok: false,
        message: `type must be one of: ${OBSERVATION_TYPES.join(", ")}`,
        error: {
          code: "BAD_REQUEST",
          message: `type must be one of: ${OBSERVATION_TYPES.join(", ")}`,
        },
      });
    }

    if (role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    const observation = await prisma.coachObservation.create({
      data: {
        centerId,
        coachId: session.user.id,
        teacherId,
        type,
        classRoomId: optionalString(body, "classRoomId", { nullable: true }),
        date: optionalDate(body, "date") || new Date(),
        duration: optionalNumber(body, "duration", { integer: true, min: 1, nullable: true }) ?? null,
        score: optionalNumber(body, "score", { min: 0, nullable: true }) ?? null,
        strengths: optionalString(body, "strengths", { nullable: true }),
        improvements: optionalString(body, "improvements", { nullable: true }),
        actionItems: optionalString(body, "actionItems", { nullable: true }),
        notes: optionalString(body, "notes", { nullable: true }),
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(observation);
  }

  if (req.method === "PUT") {
    const body = ensureObject(req.body || {});
    const id = requiredString(body, "id");
    const existing = await prisma.coachObservation.findUnique({ where: { id } });
    if (!existing) throw notFound("Observation not found");
    if (role !== "ADMIN" && existing.coachId !== session.user.id) throw forbidden();

    const updated = await prisma.coachObservation.update({
      where: { id },
      data: {
        ...(body.score !== undefined ? { score: optionalNumber(body, "score", { min: 0, nullable: true }) } : {}),
        ...(body.strengths !== undefined ? { strengths: optionalString(body, "strengths", { nullable: true }) } : {}),
        ...(body.improvements !== undefined ? { improvements: optionalString(body, "improvements", { nullable: true }) } : {}),
        ...(body.actionItems !== undefined ? { actionItems: optionalString(body, "actionItems", { nullable: true }) } : {}),
        ...(body.notes !== undefined ? { notes: optionalString(body, "notes", { nullable: true }) } : {}),
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        teacher: { select: { id: true, name: true, email: true } },
        classRoom: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json(updated);
  }

  const id = optionalString(req.query, "id");
  if (!id) {
    return res.status(400).json({
      ok: false,
      message: "id is required",
      error: { code: "BAD_REQUEST", message: "id is required" },
    });
  }

  const existing = await prisma.coachObservation.findUnique({ where: { id } });
  if (!existing) throw notFound("Observation not found");
  if (role !== "ADMIN" && existing.coachId !== session.user.id) throw forbidden();

  await prisma.coachObservation.delete({ where: { id } });
  return res.status(200).json({ success: true });
}, { methods: ["GET", "POST", "PUT", "DELETE"], logLabel: "coach/observations error:" });
