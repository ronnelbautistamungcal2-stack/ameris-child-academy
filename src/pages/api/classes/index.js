import { getSession, hasAccessToCenter } from "@/lib/auth";
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

  const { centerId } = req.query;

  // Check center access
  if (centerId && session.user.role !== "ADMIN") {
    const hasAccess = await hasAccessToCenter(session.user.id, centerId);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const classes = await prisma.classRoom.findMany({
      where: centerId ? { centerId } : {},
      include: { children: true, teachers: { include: { teacher: true } } },
    });
    return res.status(200).json(classes);
  }

  if (req.method === "POST") {
    if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, centerId: cId, capacity, ageRange } = req.body;
    if (!name || !cId)
      return res.status(400).json({ error: "Name and centerId required" });

    let parsedCapacity = null;
    try {
      parsedCapacity = parseOptionalInt(capacity);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid capacity" });
    }

    const classroom = await prisma.classRoom.create({
      data: {
        name,
        centerId: cId,
        capacity: parsedCapacity,
        ageRange:
          typeof ageRange === "string" && ageRange.trim()
            ? ageRange.trim()
            : null,
      },
      include: { children: true, teachers: true },
    });

    return res.status(201).json(classroom);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
