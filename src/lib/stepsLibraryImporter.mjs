import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import { canonicalizeLessonCategoryName } from "./lessonCategoryNormalization.mjs";
import { normalizeSubjectForRef } from "./subjectNormalization.mjs";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function looksLikeLink(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  if (s.startsWith("/")) return true;
  return /\.[a-z0-9]{2,5}($|[?#\s])/i.test(s);
}

function splitResources(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|\n|;)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const normalized = row.map(normalizeHeader);
    const hasRef =
      normalized.includes("referance#") || normalized.includes("reference#");
    const hasStep =
      normalized.includes("step of progression") ||
      normalized.includes("step of progresssion");
    const hasLesson = normalized.includes("lesson");
    if (hasRef && hasStep && hasLesson) return i;
  }
  return -1;
}

function cell(rows, rowIndex, columnIndex) {
  const row = rows[rowIndex] || [];
  return row[columnIndex] ?? "";
}

function buildColumnIndex(headerRow) {
  const index = new Map();
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader(headerRow[i]);
    if (!key) continue;
    if (!index.has(key)) index.set(key, i);
  }
  return index;
}

function col(index, ...names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    if (index.has(key)) return index.get(key);
  }
  return -1;
}

function normalizeKind(value, fallback = "PACKAGE") {
  const v = String(value || "").trim().toUpperCase();
  if (v === "PROGRAM") return "PROGRAM";
  if (v === "PACKAGE") return "PACKAGE";
  if (v === "DOMAIN") return "DOMAIN";
  return fallback;
}

export async function importStepsLibrary({
  prisma,
  centerId,
  workbookPath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "StepsofProgressionLibrary.xlsx",
  ),
  includeCondensedSheet = false,
  categorySource = "category", // "subject" (recommended) or "category"
  categoryKind = "PACKAGE", // PACKAGE | PROGRAM | DOMAIN
  forceKindUpdate = false,
}) {
  if (!centerId) throw new Error("centerId is required");

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`XLSX not found at ${workbookPath}`);
  }

  const wb = xlsx.readFile(workbookPath, { cellDates: true });
  const sheetNames = wb.SheetNames || [];
  const selectedSheetNames = includeCondensedSheet
    ? sheetNames
    : sheetNames.filter(
        (n) => normalizeHeader(n) !== normalizeHeader("new condensed list"),
      );

  const existingCenter = await prisma.center.findUnique({
    where: { id: centerId },
  });
  if (!existingCenter) throw new Error("Center not found");

  const categoryByName = new Map();
  const lessonByKey = new Map();

  const summary = {
    sheets: selectedSheetNames.length,
    rowsSeen: 0,
    rowsImported: 0,
    categoriesCreated: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    goalsCreated: 0,
    goalsSkippedExisting: 0,
    rowsSkippedNoStep: 0,
  };

  function canonicalizeGroupName(value) {
    const v = canonicalizeLessonCategoryName(value);
    return v || null;
  }

  async function getOrCreateCategory({ name: rawName, groupName }) {
    const desiredKind = normalizeKind(categoryKind, "PACKAGE");
    const name = canonicalizeLessonCategoryName(rawName);
    if (!name) return null;
    const cached = categoryByName.get(name.toLowerCase());
    if (cached) return cached;

    const matches = await prisma.lessonCategory.findMany({
      where: { centerId, name: { equals: name, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (matches.length) {
      const preferred = matches.find((c) => c.name === name) || matches[0];
      const next = {};
      if (!preferred.kind) next.kind = desiredKind;
      if (
        forceKindUpdate &&
        desiredKind &&
        String(preferred.kind || "").toUpperCase() !== desiredKind
      ) {
        next.kind = desiredKind;
      }
      if (!preferred.groupName && groupName) next.groupName = groupName;
      if (Object.keys(next).length) {
        const updated = await prisma.lessonCategory.update({
          where: { id: preferred.id },
          data: next,
        });
        categoryByName.set(name.toLowerCase(), updated);
        return updated;
      }
      categoryByName.set(name.toLowerCase(), preferred);
      return preferred;
    }

    const created = await prisma.lessonCategory.create({
      data: { centerId, name, kind: desiredKind, groupName: groupName || null },
    });
    summary.categoriesCreated += 1;
    categoryByName.set(name.toLowerCase(), created);
    return created;
  }


  async function getOrCreateLesson({ title, description, categoryId, media }) {
    const normalizedTitle = String(title || "").trim();
    if (!normalizedTitle) return null;

    const key = `${centerId}::${normalizedTitle.toLowerCase()}`;
    const cached = lessonByKey.get(key);
    if (cached) return cached;

    const existing = await prisma.lesson.findFirst({
      where: { centerId, title: normalizedTitle },
      include: {
        goals: {
          select: { id: true, title: true, goalIndex: true, description: true, passingCriteria: true },
        },
      },
    });

    if (existing) {
      lessonByKey.set(key, existing);

      const nextData = {};
      if (!existing.categoryId && categoryId) nextData.categoryId = categoryId;
      if (!existing.description && description) nextData.description = description;
      const nextMedia = Array.isArray(existing.media) ? [...existing.media] : [];
      for (const m of media || []) {
        if (!nextMedia.includes(m)) nextMedia.push(m);
      }
      if (
        nextMedia.length &&
        nextMedia.length !== (existing.media || []).length
      ) {
        nextData.media = nextMedia;
      }

      if (Object.keys(nextData).length) {
        const updated = await prisma.lesson.update({
          where: { id: existing.id },
          data: nextData,
          include: {
            goals: {
              select: { id: true, title: true, goalIndex: true, description: true, passingCriteria: true },
            },
          },
        });
        summary.lessonsUpdated += 1;
        lessonByKey.set(key, updated);
        return updated;
      }

      return existing;
    }

    const created = await prisma.lesson.create({
      data: {
        centerId,
        title: normalizedTitle,
        description: description || null,
        categoryId: categoryId || null,
        media: Array.isArray(media) ? media : [],
      },
      include: {
        goals: { select: { id: true, title: true, goalIndex: true, description: true, passingCriteria: true } },
      },
    });
    summary.lessonsCreated += 1;
    lessonByKey.set(key, created);
    return created;
  }

  for (const sheetName of selectedSheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    const headerRowIndex = findHeaderRow(rows);
    if (headerRowIndex < 0) continue;

    const header = rows[headerRowIndex] || [];
    const idx = buildColumnIndex(header);

    const cRef = col(idx, "Referance#", "Reference#");
    const cAge = col(idx, "Child Age");
    const cTerm = col(idx, "Term");
    const cStep = col(idx, "Step Of Progression", "Step of progression");
    const cTest = col(idx, "Testing Question");
    const cCategory = col(idx, "Category");
    const cSubject = col(idx, "Subject");
    const cLesson = col(idx, "Lesson");
    const cResource = col(idx, "Resource");
    const cAdditional = col(idx, "Additional Resources");
    const cNotes = col(idx, "Notes");

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      summary.rowsSeen += 1;
      const step = cStep >= 0 ? cell(rows, r, cStep) : "";
      const lessonTitle = cLesson >= 0 ? cell(rows, r, cLesson) : "";
      const categoryName = cCategory >= 0 ? cell(rows, r, cCategory) : "";
      const subject = cSubject >= 0 ? cell(rows, r, cSubject) : "";
      const testingQuestion = cTest >= 0 ? cell(rows, r, cTest) : "";
      const ref = cRef >= 0 ? cell(rows, r, cRef) : "";
      const age = cAge >= 0 ? cell(rows, r, cAge) : "";
      const term = cTerm >= 0 ? cell(rows, r, cTerm) : "";
      const resource = cResource >= 0 ? cell(rows, r, cResource) : "";
      const additional = cAdditional >= 0 ? cell(rows, r, cAdditional) : "";
      const notes = cNotes >= 0 ? cell(rows, r, cNotes) : "";

      const normalizedStep = String(step || "").trim();
      if (!normalizedStep) {
        if (
          !String(lessonTitle || "").trim() &&
          !String(categoryName || "").trim()
        ) {
          continue;
        }
        summary.rowsSkippedNoStep += 1;
        continue;
      }

      const rawStep = String(step ?? "");
      const rawLesson = String(lessonTitle ?? "");
      const rawCategory = String(categoryName ?? "");
      const rawSubject = String(subject ?? "");
      const normalizedSubject = normalizeSubjectForRef({
        subject: rawSubject,
        refId: rawRef,
      });
      const rawRef = String(ref ?? "");
      const rawAge = String(age ?? "");
      const rawTerm = String(term ?? "");
      const rawTestingQuestion = String(testingQuestion ?? "");
      const rawResource = String(resource ?? "");
      const rawAdditional = String(additional ?? "");
      const rawNotes = String(notes ?? "");

      const lessonName = rawLesson.trim() || rawStep.trim() || normalizedStep;

      const groupName = canonicalizeGroupName(rawCategory);
      const sourceName =
        String(categorySource || "").toLowerCase() === "category"
          ? rawCategory
          : rawSubject || rawCategory;

      const category = await getOrCreateCategory({
        name: sourceName,
        groupName,
      });

      const media = [
        ...splitResources(resource).filter(looksLikeLink),
        ...splitResources(additional).filter(looksLikeLink),
      ];

      const lesson = await getOrCreateLesson({
        title: lessonName,
        description: null,
        categoryId: category?.id || null,
        media,
      });
      if (!lesson) continue;

      const existingGoalTitles = new Set(
        (lesson.goals || []).map((g) =>
          String(g.title || "").trim().toLowerCase(),
        ),
      );
      if (existingGoalTitles.has(normalizedStep.toLowerCase())) {
        const existingGoal = (lesson.goals || []).find(
          (g) =>
            String(g.title || "").trim().toLowerCase() === normalizedStep.toLowerCase(),
        );
        if (existingGoal?.id) {
          const existingPc =
            existingGoal.passingCriteria && typeof existingGoal.passingCriteria === "object"
              ? existingGoal.passingCriteria
              : {};
          const nextPc = { ...existingPc };
          const incomingPc = {
            reference: rawRef,
            term: rawTerm,
            lesson: rawLesson,
            stepOfProgression: rawStep,
            testingQuestion: rawTestingQuestion,
            resource: rawResource,
            additionalResources: rawAdditional,
            notes: rawNotes,
            age: rawAge,
            category: rawCategory,
            subject: normalizedSubject,
            sheet: sheetName,
          };

          for (const [k, v] of Object.entries(incomingPc)) {
            const cur = nextPc[k];
            const hasCur = cur !== null && cur !== undefined && String(cur) !== "";
            const hasNext = v !== null && v !== undefined && String(v) !== "";
            if (!hasCur && hasNext) nextPc[k] = v;
            if (!hasCur && !hasNext && (cur === null || cur === undefined)) nextPc[k] = v;
          }

          await prisma.lessonGoal.update({
            where: { id: existingGoal.id },
            data: {
              passingCriteria: nextPc,
              description:
                existingGoal.description && String(existingGoal.description) !== ""
                  ? undefined
                  : rawTestingQuestion || null,
            },
          });
        }
        summary.goalsSkippedExisting += 1;
        summary.rowsImported += 1;
        continue;
      }

      const maxIndex = (lesson.goals || []).reduce(
        (m, g) => Math.max(m, Number(g.goalIndex || 0)),
        0,
      );
      const goalIndex = maxIndex + 1;

      await prisma.lessonGoal.create({
        data: {
          lessonId: lesson.id,
          goalIndex,
          title: rawStep,
          description: rawTestingQuestion || null,
          passingCriteria: {
            reference: rawRef,
            term: rawTerm,
            lesson: rawLesson,
            stepOfProgression: rawStep,
            testingQuestion: rawTestingQuestion,
            resource: rawResource,
            additionalResources: rawAdditional,
            notes: rawNotes,
            age: rawAge,
            category: rawCategory,
            subject: normalizedSubject,
            sheet: sheetName,
          },
        },
      });

      summary.goalsCreated += 1;
      summary.rowsImported += 1;

      // Keep cache in sync to make indexing/skipping correct within the same import run
      lesson.goals = [...(lesson.goals || []), { title: rawStep, goalIndex }];
    }
  }

  return summary;
}
