import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_ROW_COUNT = 10;

function buildActiveRows(dbRows) {
  const byIndex = Object.fromEntries(dbRows.map((r) => [r.rowIndex, r]));
  const maxDbIndex = dbRows.reduce((max, r) => Math.max(max, r.rowIndex), -1);
  const maxIndex = Math.max(DEFAULT_ROW_COUNT - 1, maxDbIndex);

  const result = [];
  for (let i = 0; i <= maxIndex; i += 1) {
    const dbRow = byIndex[i];
    if (dbRow) {
      if (dbRow.active) {
        result.push({
          id: dbRow.id,
          rowIndex: i,
          label: dbRow.label || "",
          position: Number.isInteger(dbRow.position) ? dbRow.position : i,
        });
      }
    } else if (i < DEFAULT_ROW_COUNT) {
      result.push({ id: null, rowIndex: i, label: "", position: i });
    }
  }
  // Rows keep their identity (rowIndex, which lesson-plan cells reference) even
  // when dragged to a new spot — only their display `position` changes.
  result.sort((a, b) => a.position - b.position || a.rowIndex - b.rowIndex);
  return result;
}

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

    return res.status(200).json(buildActiveRows(rows));
  }

  if (req.method === "PUT") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update lesson plan rows" });
    }
    const { centerId, classRoomId, order } = req.body || {};

    if (Array.isArray(order)) {
      // Drag-to-reorder: `order` is the full list of rowIndex values in their
      // new display order. rowIndex itself never changes here, so every cell
      // and lesson already attached to a category (keyed by rowIndex) stays
      // attached — only the row's `position` (display order) is updated.
      if (!centerId || !classRoomId) {
        return res.status(400).json({ error: "centerId and classRoomId are required" });
      }
      const rowIndexes = order.map(Number);
      if (
        rowIndexes.length === 0 ||
        rowIndexes.some((n) => !Number.isInteger(n) || n < 0) ||
        new Set(rowIndexes).size !== rowIndexes.length
      ) {
        return res.status(400).json({ error: "order must be a list of unique, non-negative row indexes" });
      }
      const ok = await hasAccessToCenter(session.user.id, centerId);
      if (!ok) return res.status(403).json({ error: "Forbidden" });

      const existing = await prisma.lessonPlanRow.findMany({ where: { centerId, classRoomId } });
      const existingByIndex = Object.fromEntries(existing.map((r) => [r.rowIndex, r]));

      await prisma.$transaction(
        rowIndexes.map((rowIndex, position) =>
          prisma.lessonPlanRow.upsert({
            where: { classRoomId_rowIndex: { classRoomId, rowIndex } },
            update: { position },
            create: {
              centerId,
              classRoomId,
              rowIndex,
              label: existingByIndex[rowIndex]?.label || "",
              position,
            },
          }),
        ),
      );

      const rows = await prisma.lessonPlanRow.findMany({
        where: { centerId, classRoomId },
        orderBy: { rowIndex: "asc" },
      });
      return res.status(200).json(buildActiveRows(rows));
    }

    const { rowIndex, label } = req.body || {};
    if (!centerId || !classRoomId || rowIndex === undefined || rowIndex === null) {
      return res.status(400).json({ error: "centerId, classRoomId, and rowIndex are required" });
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

  if (req.method === "POST") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can add lesson plan rows" });
    }
    const { centerId, classRoomId, label } = req.body || {};
    if (!centerId || !classRoomId) {
      return res.status(400).json({ error: "centerId and classRoomId are required" });
    }
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const existing = await prisma.lessonPlanRow.findMany({
      where: { centerId, classRoomId },
      select: { rowIndex: true },
    });
    const maxDbIndex = existing.reduce((max, r) => Math.max(max, r.rowIndex), -1);
    const nextIndex = Math.max(DEFAULT_ROW_COUNT - 1, maxDbIndex) + 1;

    const row = await prisma.lessonPlanRow.create({
      data: {
        centerId,
        classRoomId,
        rowIndex: nextIndex,
        label: label || "New Category",
        active: true,
      },
    });

    return res.status(201).json(row);
  }

  if (req.method === "DELETE") {
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete lesson plan rows" });
    }
    const { centerId, classRoomId, rowIndex } = req.body || {};
    if (!centerId || !classRoomId || rowIndex === undefined || rowIndex === null) {
      return res.status(400).json({ error: "centerId, classRoomId, and rowIndex are required" });
    }
    const ok = await hasAccessToCenter(session.user.id, centerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const dbRows = await prisma.lessonPlanRow.findMany({
      where: { centerId, classRoomId },
      orderBy: { rowIndex: "asc" },
    });
    const activeCount = buildActiveRows(dbRows).length;
    if (activeCount <= 1) {
      return res.status(400).json({ error: "At least one category is required" });
    }

    const existing = dbRows.find((r) => r.rowIndex === Number(rowIndex));
    const row = await prisma.lessonPlanRow.upsert({
      where: { classRoomId_rowIndex: { classRoomId, rowIndex: Number(rowIndex) } },
      update: { active: false },
      create: {
        centerId,
        classRoomId,
        rowIndex: Number(rowIndex),
        label: existing?.label || "",
        active: false,
      },
    });

    return res.status(200).json(row);
  }

  res.setHeader("Allow", ["GET", "PUT", "POST", "DELETE"]);
  res.status(405).end();
}
