import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ROW_COUNT = 10;

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const { centerId, classRoomId } = req.query || {};
    if (!centerId || !classRoomId) {
      return res.status(400).json({ error: "centerId and classRoomId are required" });
    }
    if (role !== "ADMIN") {
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });
    }

    const rows = await prisma.lessonPlanRow.findMany({
      where: { centerId, classRoomId },
      orderBy: { rowIndex: "asc" },
    });

    // Always return exactly ROW_COUNT rows, filling missing with defaults
    const byIndex = Object.fromEntries(rows.map((r) => [r.rowIndex, r]));
    const result = Array.from({ length: ROW_COUNT }, (_, i) => ({
      id: byIndex[i]?.id || null,
      rowIndex: i,
      label: byIndex[i]?.label || "",
    }));

    return res.status(200).json(result);
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update lesson plan rows" });
    }
    const { centerId, classRoomId, rowIndex, label } = req.body || {};
    if (!centerId || !classRoomId || rowIndex === undefined || rowIndex === null) {
      return res.status(400).json({ error: "centerId, classRoomId, and rowIndex are required" });
    }
    if (rowIndex < 0 || rowIndex >= ROW_COUNT) {
      return res.status(400).json({ error: `rowIndex must be 0–${ROW_COUNT - 1}` });
    }
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const row = await prisma.lessonPlanRow.upsert({
      where: { classRoomId_rowIndex: { classRoomId, rowIndex: Number(rowIndex) } },
      update: { label: label || "" },
      create: {
        centerId,
        classRoomId,
        rowIndex: Number(rowIndex),
        label: label || "",
      },
    });

    return res.status(200).json(row);
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  res.status(405).end();
}
