import { getSession } from "@/lib/auth";
import { sendDirectMessage } from "@/lib/directMessages";
import prisma from "@/lib/prisma";
import { trainingAccess } from "@/lib/trainingServer";

/**
 * PUT /api/v1/training/items/:id/progress { action, materialIndex?, userId? }
 * The signed-in staff member working through a training:
 *   start | viewMaterial (materialIndex) | complete (acknowledges it) |
 *   requestObservation | requestHandsOn (messages the center's coaches)
 * Admins and coaches signing off for a staff member (userId):
 *   observationDone | handsOnDone
 * A training is Completed once acknowledged and any required observation /
 * hands-on training is done.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }
  const item = await prisma.trainingItem.findUnique({ where: { id: String(req.query.id) } });
  if (!item) return res.status(404).json({ error: "Training not found" });
  const access = await trainingAccess(session, item.centerId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const action = String(req.body?.action || "");
  const signOff = ["observationDone", "handsOnDone"].includes(action);
  if (signOff && !["ADMIN", "COACH"].includes(session.user.role)) {
    return res.status(403).json({ error: "Only admins and coaches can sign off observations" });
  }
  const userId = signOff ? String(req.body?.userId || "") : session.user.id;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const key = { userId_trainingItemId: { userId, trainingItemId: item.id } };
  const current = (await prisma.trainingProgress.findUnique({ where: key })) || { status: "NOT_STARTED", observationStatus: "NONE", handsOnStatus: "NONE", materialsViewed: [] };
  const now = new Date();
  const next = { ...current };
  const startIfNeeded = () => {
    if (next.status === "NOT_STARTED") {
      next.status = "IN_PROGRESS";
      next.startedAt = now;
    }
  };

  if (action === "start") {
    startIfNeeded();
  } else if (action === "viewMaterial") {
    const index = Number(req.body?.materialIndex);
    const materials = Array.isArray(item.materials) ? item.materials : [];
    if (!Number.isInteger(index) || index < 0 || index >= materials.length) return res.status(400).json({ error: "Unknown material" });
    startIfNeeded();
    next.materialsViewed = [...new Set([...(Array.isArray(current.materialsViewed) ? current.materialsViewed : []), index])];
  } else if (action === "complete") {
    startIfNeeded();
    next.acknowledgedAt = current.acknowledgedAt || now;
  } else if (action === "requestObservation" || action === "requestHandsOn") {
    const field = action === "requestObservation" ? "observationStatus" : "handsOnStatus";
    if (current[field] === "COMPLETED") return res.status(400).json({ error: "That is already done" });
    startIfNeeded();
    next[field] = "REQUESTED";
    const coaches = await prisma.user.findMany({
      where: { centers: { some: { centerId: item.centerId } }, OR: [{ role: "COACH" }, { roles: { has: "COACH" } }] },
      select: { id: true },
    });
    const sender = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true } });
    const what = action === "requestObservation" ? "an observation" : "hands-on experience";
    await sendDirectMessage({
      sender,
      recipientIds: coaches.map((c) => c.id),
      centerId: item.centerId,
      title: `Training request: ${item.title}`,
      body: `${sender.name || sender.email} is requesting ${what} for the training "${item.title}". Please reply to schedule a time.`,
    });
  } else if (signOff) {
    next[action === "observationDone" ? "observationStatus" : "handsOnStatus"] = "COMPLETED";
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }

  const done =
    next.acknowledgedAt &&
    (!item.observationRequired || next.observationStatus === "COMPLETED") &&
    (!item.handsOnRequired || next.handsOnStatus === "COMPLETED");
  if (done && next.status !== "COMPLETED") {
    next.status = "COMPLETED";
    next.completedAt = now;
  }

  const data = {
    status: next.status,
    startedAt: next.startedAt ?? null,
    completedAt: next.completedAt ?? null,
    acknowledgedAt: next.acknowledgedAt ?? null,
    materialsViewed: next.materialsViewed ?? [],
    observationStatus: next.observationStatus,
    handsOnStatus: next.handsOnStatus,
  };
  const saved = await prisma.trainingProgress.upsert({ where: key, update: data, create: { userId, trainingItemId: item.id, ...data } });
  // A finished library training counts toward the staff member's training
  // hours (Staff Training / View Training) as in-house training.
  if (done && current.status !== "COMPLETED" && item.hours > 0) {
    await prisma.trainingLog.create({
      data: {
        userId,
        centerId: item.centerId,
        topic: item.title,
        description: item.description,
        hours: item.hours,
        nonInteractiveHours: item.hours,
        interactiveHours: 0,
        source: "In-House Training",
        category: item.category || "Other",
        date: now,
        recordedById: session.user.id,
      },
    });
  }
  return res.status(200).json(saved);
}
