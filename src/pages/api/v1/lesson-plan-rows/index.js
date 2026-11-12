import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_ROW_COUNT, buildActiveRows } from "@/lib/lessonPlanRows";
import { plannerTarget, rowKey } from "@/lib/curriculumPlans";

/**
 * Lesson Planner category rows, for a curriculum plan (planId) or a
 * classroom's own planner (classRoomId).
 * GET    ?centerId=&planId=|classRoomId=
 * PUT    { centerId, planId|classRoomId, order: [rowIndex...] }   reorder (admin)
 * PUT    { centerId, planId|classRoomId, rowIndex, label }         rename (admin)
 * POST   { centerId, planId|classRoomId, label }                   add (admin)
 * DELETE { centerId, planId|classRoomId, rowIndex }                hide (admin)
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  if (!["ADMIN", "TEACHER", "COACH"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const listRows = (target) => prisma.lessonPlanRow.findMany({ where: { [target.field]: target.id }, orderBy: { rowIndex: "asc" } });

  if (req.method === "GET") {
    const access = await plannerTarget(session.user, req.query || {});
    if (access.error) return res.status(access.status).json({ error: access.error });
    return res.status(200).json(buildActiveRows(await listRows(access.target)));
  }

  if (!["PUT", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["GET", "PUT", "POST", "DELETE"]);
    return res.status(405).end();
  }
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Only admins can change lesson plan rows" });
  }
  const body = req.body || {};
  const access = await plannerTarget(session.user, body, { admin: true });
  if (access.error) return res.status(access.status).json({ error: access.error });
  const { target } = access;
  const owner = { centerId: target.centerId, [target.field]: target.id };

  if (req.method === "PUT" && Array.isArray(body.order)) {
    // Drag-to-reorder: `order` is the full list of rowIndex values in their
    // new display order. rowIndex itself never changes, so every cell and
    // lesson attached to a category (keyed by rowIndex) stays attached; only
    // the row's `position` (display order) is updated.
    const rowIndexes = body.order.map(Number);
    if (rowIndexes.length === 0 || rowIndexes.some((n) => !Number.isInteger(n) || n < 0) || new Set(rowIndexes).size !== rowIndexes.length) {
      return res.status(400).json({ error: "order must be a list of unique, non-negative row indexes" });
    }
    const existing = await listRows(target);
    const existingByIndex = Object.fromEntries(existing.map((r) => [r.rowIndex, r]));
    await prisma.$transaction(
      rowIndexes.map((rowIndex, position) =>
        prisma.lessonPlanRow.upsert({
          where: rowKey(target, rowIndex),
          update: { position },
          create: { ...owner, rowIndex, label: existingByIndex[rowIndex]?.label || "", position },
        }),
      ),
    );
    return res.status(200).json(buildActiveRows(await listRows(target)));
  }

  if (req.method === "PUT") {
    const { rowIndex, label } = body;
    if (rowIndex === undefined || rowIndex === null) return res.status(400).json({ error: "rowIndex is required" });
    // rowIndex has to name a row that is actually on the plan: one of the
    // defaults, or one POST has appended since.
    const parsedRowIndex = Number(rowIndex);
    const storedRows = await listRows(target);
    const maxRowIndex = Math.max(DEFAULT_ROW_COUNT - 1, storedRows.reduce((max, r) => Math.max(max, r.rowIndex), -1));
    if (!Number.isInteger(parsedRowIndex) || parsedRowIndex < 0 || parsedRowIndex > maxRowIndex) {
      return res.status(400).json({ error: "rowIndex is out of range" });
    }
    const row = await prisma.lessonPlanRow.upsert({
      where: rowKey(target, parsedRowIndex),
      update: { label: label || "" },
      create: { ...owner, rowIndex: parsedRowIndex, label: label || "" },
    });
    return res.status(200).json(row);
  }

  if (req.method === "POST") {
    const existing = await listRows(target);
    const maxDbIndex = existing.reduce((max, r) => Math.max(max, r.rowIndex), -1);
    const nextIndex = Math.max(DEFAULT_ROW_COUNT - 1, maxDbIndex) + 1;
    const row = await prisma.lessonPlanRow.create({
      data: { ...owner, rowIndex: nextIndex, label: body.label || "New Category", active: true },
    });
    return res.status(201).json(row);
  }

  // DELETE: hide the row (cells keep their rowIndex).
  const { rowIndex } = body;
  if (rowIndex === undefined || rowIndex === null) return res.status(400).json({ error: "rowIndex is required" });
  const dbRows = await listRows(target);
  if (buildActiveRows(dbRows).length <= 1) {
    return res.status(400).json({ error: "At least one category is required" });
  }
  const existing = dbRows.find((r) => r.rowIndex === Number(rowIndex));
  const row = await prisma.lessonPlanRow.upsert({
    where: rowKey(target, Number(rowIndex)),
    update: { active: false },
    create: { ...owner, rowIndex: Number(rowIndex), label: existing?.label || "", active: false },
  });
  return res.status(200).json(row);
}
