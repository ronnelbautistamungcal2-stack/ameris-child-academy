import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can manage staff advancement" });
    }

    const { id } = req.query;

    if (req.method === "PUT") return handlePut(req, res, session, id);
    if (req.method === "DELETE") return handleDelete(req, res, session, id);

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (error) {
    console.error("staff-advancement/[id] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(req, res, session, id) {
  const existing = await prisma.staffAdvancement.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const allowed = await hasAccessToCenter(session.user.id, existing.centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const { title, description, category, media, sortOrder, steps } = req.body || {};
  if (!String(title || "").trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  const normalizedSteps = normalizeSteps(steps);

  await prisma.staffAdvancementStep.deleteMany({ where: { advancementId: id } });

  const updated = await prisma.staffAdvancement.update({
    where: { id },
    data: {
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

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session, id) {
  const existing = await prisma.staffAdvancement.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const allowed = await hasAccessToCenter(session.user.id, existing.centerId);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  await prisma.staffAdvancement.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
