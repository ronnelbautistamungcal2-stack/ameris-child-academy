import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeStepTerm, parseStepAge, STEP_CRITERIA_LEVELS } from "@/lib/progressionSteps";

// Steps of Progression Bank import. The page reads the Excel/CSV file and
// posts its rows here. A row whose Ref ID matches a step already in the bank
// updates that step; any other row adds a step. Builds On / Leads To are Ref
// IDs, linked once every row is saved so a row can point at a later one.

const MAX_ROWS = 2000;
const text = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const lower = (value) => text(value, 500).toLowerCase();

/** POST /api/v1/lessons/import-steps  { centerId, rows: [{ line, reference, title, ... }] } (admin) */
export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const centerId = String(req.body?.centerId || "");
    const input = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!centerId) return res.status(400).json({ error: "centerId is required" });
    if (!input.length) return res.status(400).json({ error: "The file has no steps to import" });
    if (input.length > MAX_ROWS) return res.status(400).json({ error: `Import up to ${MAX_ROWS} steps at a time` });
    if (!(await prisma.center.findUnique({ where: { id: centerId }, select: { id: true } }))) {
      return res.status(404).json({ error: "Center not found" });
    }

    const skipped = [];
    const warnings = [];
    const seenRefs = new Set();
    const rows = [];
    for (const [i, raw] of input.entries()) {
      const line = Number(raw?.line) || i + 2;
      const reference = text(raw?.reference, 60);
      const title = text(raw?.title, 500);
      if (!reference || !title) {
        skipped.push({ line, reason: !reference ? "No Ref ID" : "No Step Description" });
        continue;
      }
      if (seenRefs.has(reference.toLowerCase())) {
        skipped.push({ line, reason: `Ref ID ${reference} is already used earlier in the file` });
        continue;
      }
      const age = parseStepAge({ ageYears: text(raw?.ageYears, 10), ageMonths: text(raw?.ageMonths, 10) });
      if (age.error) {
        skipped.push({ line, reason: age.error });
        continue;
      }
      seenRefs.add(reference.toLowerCase());
      rows.push({ line, reference, title, age: age.data, raw });
    }

    // Categories are LessonCategory rows, matched by name (ignoring case).
    const categories = await prisma.lessonCategory.findMany({ where: { centerId }, select: { id: true, name: true, ageRange: true } });
    const categoryIds = new Map();
    for (const c of [...categories].sort((a, b) => Number(Boolean(a.ageRange)) - Number(Boolean(b.ageRange)))) {
      if (!categoryIds.has(c.name.toLowerCase())) categoryIds.set(c.name.toLowerCase(), c.id);
    }
    async function categoryIdFor(name) {
      if (!name) return null;
      const key = name.toLowerCase();
      if (!categoryIds.has(key)) {
        const created = await prisma.lessonCategory.create({ data: { centerId, name } });
        categoryIds.set(key, created.id);
      }
      return categoryIds.get(key);
    }

    const existing = await prisma.lesson.findMany({ where: { centerId, isStep: true }, select: { id: true, reference: true } });
    const idByRef = new Map(existing.filter((s) => s.reference).map((s) => [s.reference.trim().toLowerCase(), s.id]));

    let created = 0;
    let updated = 0;
    const newOptions = { CATEGORY: new Set(), SUBJECT: new Set() };
    for (const row of rows) {
      const { raw } = row;
      const category = text(raw.category, 120);
      const subject = text(raw.subject, 120);
      if (category) newOptions.CATEGORY.add(category);
      if (subject) newOptions.SUBJECT.add(subject);
      const criteria = Object.fromEntries(STEP_CRITERIA_LEVELS.map(({ key }) => [key, text(raw[key], 500) || null]));
      const data = {
        title: row.title,
        reference: row.reference,
        categoryId: await categoryIdFor(category),
        subCategory: subject || null,
        term: normalizeStepTerm(text(raw.term, 40)) || null,
        ageYears: row.age.ageYears ?? null,
        ageMonths: row.age.ageMonths ?? null,
        description: String(raw.description ?? "").trim().slice(0, 2000) || null,
        criteria,
        notes: String(raw.notes ?? "").trim().slice(0, 2000) || null,
      };
      const id = idByRef.get(row.reference.toLowerCase());
      if (id) {
        // Columns missing from the file leave those fields as they are.
        const sources = {
          categoryId: ["category"],
          subCategory: ["subject"],
          term: ["term"],
          ageYears: ["ageYears"],
          ageMonths: ["ageMonths"],
          description: ["description"],
          criteria: STEP_CRITERIA_LEVELS.map(({ key }) => key),
          notes: ["notes"],
        };
        for (const [field, columns] of Object.entries(sources)) {
          if (columns.every((column) => raw[column] === undefined)) delete data[field];
        }
        await prisma.lesson.update({ where: { id }, data });
        updated += 1;
      } else {
        const step = await prisma.lesson.create({ data: { ...data, centerId, isStep: true }, select: { id: true } });
        idByRef.set(row.reference.toLowerCase(), step.id);
        created += 1;
      }
    }

    // Builds On / Leads To, by Ref ID among the bank's steps.
    let linked = 0;
    for (const row of rows) {
      const id = idByRef.get(row.reference.toLowerCase());
      const link = {};
      for (const [field, column, label] of [
        ["priorStepId", "buildsOn", "Builds On"],
        ["nextStepId", "leadsTo", "Leads To"],
      ]) {
        const ref = lower(row.raw[column]);
        if (!ref) continue;
        const target = idByRef.get(ref);
        if (!target) warnings.push({ line: row.line, reason: `${label}: no step with Ref ID ${text(row.raw[column], 60)}` });
        else if (target === id) warnings.push({ line: row.line, reason: `${label} cannot be the step itself` });
        else link[field] = target;
      }
      if (link.priorStepId && link.priorStepId === link.nextStepId) {
        warnings.push({ line: row.line, reason: "Builds On and Leads To must be different steps" });
        delete link.nextStepId;
      }
      if (Object.keys(link).length) {
        await prisma.lesson.update({ where: { id }, data: link });
        linked += 1;
      }
    }

    // Add new categories and subjects to the Curriculum > Categories lists,
    // skipping names already there in any capitalisation.
    for (const kind of Object.keys(newOptions)) {
      const have = new Set(
        (await prisma.curriculumOption.findMany({ where: { centerId, kind }, select: { name: true } })).map((o) => o.name.toLowerCase()),
      );
      const add = [...newOptions[kind]].filter((name) => !have.has(name.toLowerCase()));
      if (add.length) await prisma.curriculumOption.createMany({ data: add.map((name) => ({ centerId, kind, name })), skipDuplicates: true });
    }

    return res.status(200).json({ created, updated, linked, skipped, warnings });
  } catch (e) {
    console.error("step import error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
