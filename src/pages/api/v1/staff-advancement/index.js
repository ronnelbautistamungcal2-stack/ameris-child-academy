import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";

function includeConfig() {
  return {
    steps: {
      orderBy: [{ stepIndex: "asc" }, { createdAt: "asc" }],
    },
  };
}

function normalizeSteps(input) {
  return (Array.isArray(input) ? input : [])
    .map((step, index) => ({
      stepIndex: Number.isFinite(Number(step?.stepIndex)) ? Number(step.stepIndex) : index + 1,
      title: String(step?.title || "").trim(),
      description: step?.description ? String(step.description).trim() : null,
      resource: step?.resource ? String(step.resource).trim() : null,
      notes: step?.notes ? String(step.notes).trim() : null,
    }))
    .filter((step) => step.title);
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!isEmployeeRole(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res, session);
    if (req.method === "POST") return handlePost(req, res, session);

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (error) {
    console.error("staff-advancement error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId } = req.query || {};
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await prisma.staffAdvancement.findMany({
    where: { centerId },
    include: includeConfig(),
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });

  return res.status(200).json(rows);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage staff advancement" });
  }

  const { centerId, title, description, category, media, sortOrder, steps } = req.body || {};
  if (!centerId || !String(title || "").trim()) {
    return res.status(400).json({ error: "centerId and title are required" });
  }

  const allowed = await hasAccessToCenter(session.user.id, centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const normalizedSteps = normalizeSteps(steps);

  const created = await prisma.staffAdvancement.create({
    data: {
      centerId,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      category: category ? String(category).trim() : null,
      media: Array.isArray(media) ? media.filter(Boolean) : [],
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      steps: normalizedSteps.length
        ? { create: normalizedSteps }
        : undefined,
    },
    include: includeConfig(),
  });

  return res.status(201).json(created);
}
