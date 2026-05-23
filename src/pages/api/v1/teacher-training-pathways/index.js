import { getSession, hasAccessToCenter } from "@/lib/auth";
import { parseAllDayEventDate } from "@/lib/calendar";
import prisma from "@/lib/prisma";
import { isEmployeeRole } from "@/lib/roles";

function normalizeTopics(input) {
  return (Array.isArray(input) ? input : [])
    .map((topic, index) => ({
      sortOrder: Number.isFinite(Number(topic?.sortOrder)) ? Number(topic.sortOrder) : index,
      title: String(topic?.title || "").trim(),
      description: topic?.description ? String(topic.description).trim() : null,
      resourceUrl: topic?.resourceUrl ? String(topic.resourceUrl).trim() : null,
      durationHours:
        topic?.durationHours === "" || topic?.durationHours === null || topic?.durationHours === undefined
          ? null
          : Number(topic.durationHours),
      required: topic?.required !== undefined ? !!topic.required : true,
      notes: topic?.notes ? String(topic.notes).trim() : null,
    }))
    .filter((topic) => topic.title);
}

function includeConfig() {
  return {
    topics: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    },
    createdBy: {
      select: { id: true, name: true, email: true },
    },
  };
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
    console.error("teacher-training-pathways error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res, session) {
  const { centerId, includeInactive } = req.query || {};
  if (!centerId) return res.status(400).json({ error: "centerId is required" });

  if (session.user.role !== "ADMIN") {
    const allowed = await hasAccessToCenter(session.user.id, centerId);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await prisma.teacherTrainingPathway.findMany({
    where: {
      centerId,
      ...(session.user.role === "ADMIN" && String(includeInactive || "").trim() === "1"
        ? {}
        : { active: true }),
    },
    include: includeConfig(),
    orderBy: [{ active: "desc" }, { effectiveDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return res.status(200).json(rows);
}

async function handlePost(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage teacher training pathways" });
  }

  const { centerId, title, description, effectiveDate, active, topics } = req.body || {};
  if (!centerId || !String(title || "").trim()) {
    return res.status(400).json({ error: "centerId and title are required" });
  }

  const allowed = await hasAccessToCenter(session.user.id, centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const parsedEffectiveDate = effectiveDate ? parseAllDayEventDate(effectiveDate) : new Date();
  if (!parsedEffectiveDate || Number.isNaN(parsedEffectiveDate.getTime())) {
    return res.status(400).json({ error: "Invalid effectiveDate" });
  }

  const normalizedTopics = normalizeTopics(topics);

  const created = await prisma.teacherTrainingPathway.create({
    data: {
      centerId,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      effectiveDate: parsedEffectiveDate,
      active: active !== undefined ? !!active : true,
      createdById: session.user.id,
      topics: normalizedTopics.length
        ? {
            create: normalizedTopics,
          }
        : undefined,
    },
    include: includeConfig(),
  });

  return res.status(201).json(created);
}
