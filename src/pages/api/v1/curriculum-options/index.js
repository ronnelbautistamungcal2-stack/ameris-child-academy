import { getSession, hasAccessToCenter } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { OPTION_KINDS } from "@/lib/curriculumOptions";
import { hasAnyRole } from "@/lib/roles";

// Curriculum > Categories tab: the Categories, Subjects, Age Ranges and Type
// lists the lesson and step forms use. The first time a center opens them,
// each list is filled from the values its lessons already use (a hidden
// SEEDED row per list remembers that, so emptying a list keeps it empty).

const DEFAULT_AGE_RANGES = [
  "Infant (0 - 11 months)",
  "Toddler (12 - 23 months)",
  "2 Years",
  "3 Years",
  "4 Years",
  "5 Years",
  "School Age (6+ years)",
];
const DEFAULT_TYPES = ["Regular", "DCCS"];
const MAX_NAME = 120;

function clean(values) {
  return [...new Set(values.map((v) => String(v || "").trim().replace(/\s+/g, " ")).filter(Boolean))].map((v) =>
    v.slice(0, MAX_NAME),
  );
}

async function existingValues(centerId, kind) {
  if (kind === "TYPE") return DEFAULT_TYPES;
  if (kind === "CATEGORY") {
    const rows = await prisma.lessonCategory.findMany({ where: { centerId }, select: { name: true } });
    return rows.map((r) => r.name);
  }
  if (kind === "SUBJECT") {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT g."passingCriteria"->>'subject' AS v FROM "LessonGoal" g
      JOIN "Lesson" l ON l.id = g."lessonId" WHERE l."centerId" = ${centerId}
      UNION SELECT DISTINCT "subCategory" AS v FROM "Lesson" WHERE "centerId" = ${centerId}`;
    return rows.map((r) => r.v);
  }
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT g."passingCriteria"->>'age' AS v FROM "LessonGoal" g
    JOIN "Lesson" l ON l.id = g."lessonId" WHERE l."centerId" = ${centerId}
    UNION SELECT DISTINCT "ageRange" AS v FROM "LessonCategory" WHERE "centerId" = ${centerId}`;
  const found = rows.map((r) => r.v);
  return found.some(Boolean) ? found : DEFAULT_AGE_RANGES;
}

async function seedIfNeeded(centerId) {
  const seeded = new Set(
    (await prisma.curriculumOption.findMany({ where: { centerId, kind: "SEEDED" }, select: { name: true } })).map((r) => r.name),
  );
  for (const kind of OPTION_KINDS.filter((k) => !seeded.has(k))) {
    const names = clean(await existingValues(centerId, kind));
    await prisma.curriculumOption.createMany({
      data: [...names.map((name) => ({ centerId, kind, name })), { centerId, kind: "SEEDED", name: kind }],
      skipDuplicates: true,
    });
  }
}

/**
 * GET    /api/v1/curriculum-options?centerId=   { CATEGORY: [{id,name}], SUBJECT: [...], ... }
 * POST   /api/v1/curriculum-options  { centerId, kind, name }   (admin)
 * PATCH  /api/v1/curriculum-options?id=  { name }               (admin) rename; lessons
 *        and categories using the old name follow (client request 2026-10-29)
 * DELETE /api/v1/curriculum-options?id=                          (admin)
 */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;
    if (!hasAnyRole(user, ["ADMIN", "TEACHER", "COACH"])) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "GET") {
      const centerId = String(req.query.centerId || "");
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      if (!(await hasAccessToCenter(user.id, centerId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!(await prisma.center.findUnique({ where: { id: centerId }, select: { id: true } }))) {
        return res.status(404).json({ error: "Center not found" });
      }
      await seedIfNeeded(centerId);
      const rows = await prisma.curriculumOption.findMany({
        where: { centerId, kind: { in: OPTION_KINDS } },
        select: { id: true, kind: true, name: true },
      });
      const out = Object.fromEntries(OPTION_KINDS.map((k) => [k, []]));
      for (const row of rows) out[row.kind].push({ id: row.id, name: row.name });
      for (const k of OPTION_KINDS) out[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return res.status(200).json(out);
    }

    if (!hasAnyRole(user, ["ADMIN"])) return res.status(403).json({ error: "Only admins can change the curriculum lists" });

    if (req.method === "POST") {
      const { centerId, kind } = req.body || {};
      const [name] = clean([req.body?.name]);
      if (!centerId || !OPTION_KINDS.includes(kind)) return res.status(400).json({ error: "centerId and a list are required" });
      if (!name) return res.status(400).json({ error: "Enter a name" });
      const exists = await prisma.curriculumOption.findFirst({
        where: { centerId: String(centerId), kind, name: { equals: name, mode: "insensitive" } },
      });
      if (exists) return res.status(409).json({ error: `"${name}" is already on the list` });
      const row = await prisma.curriculumOption.create({ data: { centerId: String(centerId), kind, name } });
      return res.status(201).json({ id: row.id, kind: row.kind, name: row.name });
    }

    if (req.method === "PATCH") {
      const id = String(req.query.id || "");
      const row = await prisma.curriculumOption.findUnique({ where: { id } });
      if (!row || !OPTION_KINDS.includes(row.kind)) return res.status(404).json({ error: "Not found" });
      const [name] = clean([req.body?.name]);
      if (!name) return res.status(400).json({ error: "Enter a name" });
      if (name === row.name) return res.status(200).json({ id: row.id, kind: row.kind, name: row.name });
      const clash = await prisma.curriculumOption.findFirst({
        where: { centerId: row.centerId, kind: row.kind, id: { not: row.id }, name: { equals: name, mode: "insensitive" } },
      });
      if (clash) return res.status(409).json({ error: `"${name}" is already on the list` });
      const updated = await prisma.$transaction(async (tx) => {
        if (row.kind === "CATEGORY") {
          await tx.lessonCategory.updateMany({ where: { centerId: row.centerId, name: row.name }, data: { name } });
        } else if (row.kind === "SUBJECT") {
          await tx.lesson.updateMany({ where: { centerId: row.centerId, subCategory: row.name }, data: { subCategory: name } });
        } else if (row.kind === "AGE_RANGE") {
          await tx.lessonCategory.updateMany({ where: { centerId: row.centerId, ageRange: row.name }, data: { ageRange: name } });
        }
        return tx.curriculumOption.update({ where: { id: row.id }, data: { name } });
      });
      return res.status(200).json({ id: updated.id, kind: updated.kind, name: updated.name });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      const row = await prisma.curriculumOption.findUnique({ where: { id } });
      if (!row || !OPTION_KINDS.includes(row.kind)) return res.status(404).json({ error: "Not found" });
      await prisma.curriculumOption.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("curriculum options error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
