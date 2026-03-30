import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, forbidden, notFound, unauthorized } from "@/lib/api-error";
import {
  ensureObject,
  optionalDate,
  optionalString,
  requiredString,
} from "@/lib/validation";

const VALID_TYPES = ["PARENT", "CAMERA_OBSERVATION", "GENERAL"];
const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (!["ADMIN", "COACH"].includes(session.user.role)) throw forbidden();

  const role = session.user.role;

  if (req.method === "GET") {
    const centerId = optionalString(req.query, "centerId");
    const type = optionalString(req.query, "type");
    const status = optionalString(req.query, "status");
    if (centerId && role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    const where = {};
    if (centerId) where.centerId = centerId;
    if (type && VALID_TYPES.includes(type)) where.type = type;
    if (status && VALID_STATUSES.includes(status)) where.status = status;

    const followUps = await prisma.coachFollowUp.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        title: true,
        description: true,
        dueDate: true,
        completedAt: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return res.status(200).json(followUps);
  }

  if (req.method === "POST") {
    const body = ensureObject(req.body || {});
    const centerId = requiredString(body, "centerId");
    const type = requiredString(body, "type");
    const title = requiredString(body, "title");
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        ok: false,
        message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        error: {
          code: "BAD_REQUEST",
          message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        },
      });
    }

    if (role !== "ADMIN") {
      const allowed = await hasAccessToCenter(session.user.id, centerId);
      if (!allowed) throw forbidden();
    }

    const followUp = await prisma.coachFollowUp.create({
      data: {
        centerId,
        createdById: session.user.id,
        type,
        priority: VALID_PRIORITIES.includes(optionalString(body, "priority") || "")
          ? optionalString(body, "priority")
          : "MEDIUM",
        title,
        description: optionalString(body, "description", { nullable: true }),
        dueDate: optionalDate(body, "dueDate", { nullable: true }) ?? null,
        assignedToId: optionalString(body, "assignedToId", { nullable: true }),
        notes: optionalString(body, "notes", { nullable: true }),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(201).json(followUp);
  }

  if (req.method === "PUT") {
    const body = ensureObject(req.body || {});
    const id = requiredString(body, "id");
    const existing = await prisma.coachFollowUp.findUnique({ where: { id } });
    if (!existing) throw notFound("Follow-up not found");

    const status = optionalString(body, "status");
    const priority = optionalString(body, "priority");

    const updated = await prisma.coachFollowUp.update({
      where: { id },
      data: {
        ...(status && VALID_STATUSES.includes(status)
          ? {
              status,
              completedAt:
                status === "COMPLETED"
                  ? new Date()
                  : status === "OPEN" || status === "IN_PROGRESS"
                    ? null
                    : existing.completedAt,
            }
          : {}),
        ...(priority && VALID_PRIORITIES.includes(priority) ? { priority } : {}),
        ...(body.title !== undefined ? { title: optionalString(body, "title") } : {}),
        ...(body.description !== undefined
          ? { description: optionalString(body, "description", { nullable: true }) }
          : {}),
        ...(body.dueDate !== undefined ? { dueDate: optionalDate(body, "dueDate", { nullable: true }) } : {}),
        ...(body.assignedToId !== undefined
          ? { assignedToId: optionalString(body, "assignedToId", { nullable: true }) }
          : {}),
        ...(body.notes !== undefined ? { notes: optionalString(body, "notes", { nullable: true }) } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
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

  const existing = await prisma.coachFollowUp.findUnique({ where: { id } });
  if (!existing) throw notFound("Follow-up not found");
  await prisma.coachFollowUp.delete({ where: { id } });
  return res.status(200).json({ success: true });
}, { methods: ["GET", "POST", "PUT", "DELETE"], logLabel: "coach/follow-ups error:" });
