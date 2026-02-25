import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "PUT") return handlePut(req, res, session);
    if (req.method === "DELETE") return handleDelete(req, res, session);
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("training-logs/[id] error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(req, res, session) {
  const { id } = req.query;
  const log = await prisma.trainingLog.findUnique({ where: { id } });
  if (!log) return res.status(404).json({ error: "Training log not found" });

  if (session.user.role === "TEACHER" && log.userId !== session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { topic, description, hours, date, category, certificateUrl, certificateFileName } = req.body || {};
  const data = {};
  if (topic !== undefined) data.topic = topic;
  if (description !== undefined) data.description = description;
  if (hours !== undefined) data.hours = parseFloat(hours);
  if (date !== undefined) data.date = new Date(date);
  if (category !== undefined) data.category = category;
  if (certificateUrl !== undefined) data.certificateUrl = certificateUrl;
  if (certificateFileName !== undefined) data.certificateFileName = certificateFileName;

  const updated = await prisma.trainingLog.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(200).json(updated);
}

async function handleDelete(req, res, session) {
  const { id } = req.query;
  const log = await prisma.trainingLog.findUnique({ where: { id } });
  if (!log) return res.status(404).json({ error: "Training log not found" });

  if (session.user.role === "TEACHER" && log.userId !== session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.trainingLog.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
