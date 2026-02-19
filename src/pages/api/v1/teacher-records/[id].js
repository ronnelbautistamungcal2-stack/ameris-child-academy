import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  const record = await prisma.teacherRecord.findUnique({ where: { id } });
  if (!record) return res.status(404).json({ error: "Record not found" });

  if (session.user.role === "TEACHER" && record.teacherId !== session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const full = await prisma.teacherRecord.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    return res.status(200).json(full);
  }

  if (req.method === "PUT") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can edit records" });
    }

    const { title, description, type, date, fileUrl, fileName } = req.body || {};
    const data = {};
    if ("title" in (req.body || {})) data.title = title;
    if ("description" in (req.body || {})) data.description = description || null;
    if ("type" in (req.body || {})) data.type = type;
    if ("date" in (req.body || {})) data.date = date ? new Date(date) : new Date();
    if ("fileUrl" in (req.body || {})) data.fileUrl = fileUrl || null;
    if ("fileName" in (req.body || {})) data.fileName = fileName || null;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "No changes submitted" });
    }

    const updated = await prisma.teacherRecord.update({
      where: { id },
      data,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete records" });
    }

    await prisma.teacherRecord.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
