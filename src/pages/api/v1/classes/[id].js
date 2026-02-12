import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error("capacity must be an integer");
  }
  if (num < 0) throw new Error("capacity must be >= 0");
  return num;
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const classroom = await prisma.classRoom.findUnique({
      where: { id },
      include: { children: true, teachers: { include: { teacher: true } } },
    });
    if (!classroom) return res.status(404).json({ error: "Class not found" });
    return res.status(200).json(classroom);
  }

  if (req.method === "PUT") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, capacity, ageRange } = req.body;
    const data = {};

    if (typeof name === "string") data.name = name;

    if (Object.prototype.hasOwnProperty.call(req.body, "capacity")) {
      try {
        data.capacity = parseOptionalInt(capacity);
      } catch (e) {
        return res.status(400).json({ error: e.message || "Invalid capacity" });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "ageRange")) {
      data.ageRange =
        typeof ageRange === "string" && ageRange.trim()
          ? ageRange.trim()
          : null;
    }

    const classroom = await prisma.classRoom.update({
      where: { id },
      data,
      include: { children: true, teachers: true },
    });

    return res.status(200).json(classroom);
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete classes" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.child.updateMany({
          where: { classRoomId: id },
          data: { classRoomId: null },
        });

        await tx.teacherClass.deleteMany({ where: { classId: id } });
        await tx.classRoom.delete({ where: { id } });
      });

      return res.status(204).end();
    } catch (e) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Class not found" });
      }
      return res.status(500).json({ error: e?.message || "Failed to delete class" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  res.status(405).end();
}
