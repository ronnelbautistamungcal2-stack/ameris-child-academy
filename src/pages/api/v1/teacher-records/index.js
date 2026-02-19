import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_TYPES = ["CERTIFICATE", "ACHIEVEMENT", "EMPLOYEE_OF_THE_MONTH", "CAREER_LADDER"];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const { teacherId, type } = req.query;

    if (session.user.role === "TEACHER") {
      const where = { teacherId: session.user.id };
      if (type && VALID_TYPES.includes(type)) where.type = type;

      const records = await prisma.teacherRecord.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
        orderBy: { date: "desc" },
      });
      return res.status(200).json(records);
    }

    if (session.user.role === "ADMIN") {
      if (!teacherId) {
        return res.status(400).json({ error: "teacherId is required" });
      }
      const where = { teacherId };
      if (type && VALID_TYPES.includes(type)) where.type = type;

      const records = await prisma.teacherRecord.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
        orderBy: { date: "desc" },
      });
      return res.status(200).json(records);
    }

    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { teacherId, type, title, description, date, fileUrl, fileName } = req.body || {};

    if (!title || !type) {
      return res.status(400).json({ error: "title and type are required" });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    let targetTeacherId = teacherId;
    if (session.user.role === "TEACHER") {
      targetTeacherId = session.user.id;
    } else if (!targetTeacherId) {
      return res.status(400).json({ error: "teacherId is required" });
    }

    const teacher = await prisma.user.findUnique({ where: { id: targetTeacherId } });
    if (!teacher || teacher.role !== "TEACHER") {
      return res.status(400).json({ error: "Target user is not a teacher" });
    }

    const record = await prisma.teacherRecord.create({
      data: {
        teacherId: targetTeacherId,
        type,
        title,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    return res.status(201).json(record);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
