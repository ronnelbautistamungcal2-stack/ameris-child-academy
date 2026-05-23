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

    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (error) {
    console.error("teacher-training-pathways/[id] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getExistingPathway(id) {
  return prisma.teacherTrainingPathway.findUnique({
    where: { id },
    include: includeConfig(),
  });
}

async function handlePut(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage teacher training pathways" });
  }

  const { id } = req.query;
  const existing = await getExistingPathway(id);
  if (!existing) return res.status(404).json({ error: "Teacher training pathway not found" });

  const allowed = await hasAccessToCenter(session.user.id, existing.centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const { title, description, effectiveDate, active, topics } = req.body || {};
  const data = {};

  if (title !== undefined) {
    const normalizedTitle = String(title || "").trim();
    if (!normalizedTitle) return res.status(400).json({ error: "title cannot be empty" });
    data.title = normalizedTitle;
  }
  if (description !== undefined) data.description = description ? String(description).trim() : null;
  if (effectiveDate !== undefined) {
    const parsedEffectiveDate = parseAllDayEventDate(effectiveDate);
    if (!parsedEffectiveDate || Number.isNaN(parsedEffectiveDate.getTime())) {
      return res.status(400).json({ error: "Invalid effectiveDate" });
    }
    data.effectiveDate = parsedEffectiveDate;
  }
  if (active !== undefined) data.active = !!active;

  const normalizedTopics = topics !== undefined ? normalizeTopics(topics) : null;

  const updated = await prisma.teacherTrainingPathway.update({
    where: { id },
    data: {
      ...data,
      ...(normalizedTopics
        ? {
            topics: {
              deleteMany: {},
              create: normalizedTopics,
            },
          }
        : {}),
    },
    include: includeConfig(),
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can manage teacher training pathways" });
  }

  const { id } = req.query;
  const existing = await getExistingPathway(id);
  if (!existing) return res.status(404).json({ error: "Teacher training pathway not found" });

  const allowed = await hasAccessToCenter(session.user.id, existing.centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  await prisma.teacherTrainingPathway.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
