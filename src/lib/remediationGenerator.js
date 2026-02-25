/**
 * Auto-generate remediation (corrective learning path) links
 * based on reference codes from the StepsofProgressionLibrary.
 *
 * Reference code pattern: "{age}{suffix}. {DOMAIN}-{SUBJECT}.{step}."
 * Examples: "2y. D-CO.1.", "3y. A-LL.5.", "4y. A-MR.12."
 */

/**
 * Parse a reference code string into its components.
 * @returns {{ age: string, subjectCode: string, stepNumber: number } | null}
 */
function parseReference(ref) {
  if (!ref || typeof ref !== "string") return null;
  const m = ref
    .trim()
    .match(/^(\d+)\s*([a-zA-Z]*)\.\s*([a-zA-Z]+-[a-zA-Z0-9]+)\.(\d+)\./);
  if (!m) return null;
  return {
    age: `${m[1]}${m[2]}`,          // e.g. "2y"
    subjectCode: m[3].toUpperCase(), // e.g. "D-CO"
    stepNumber: parseInt(m[4], 10),  // e.g. 1
  };
}

/**
 * Generate remediation link proposals for a centre.
 *
 * Within each (subjectCode, age) bucket the goals are sorted by stepNumber.
 * For every consecutive pair the higher-step lesson becomes `fromLesson`
 * and the lower-step lesson becomes `toLesson` (the corrective recommendation).
 */
export async function generateRemediationProposals({
  prisma,
  centerId,
  skipExisting = true,
}) {
  // 1. Fetch all lessons with goals for this centre
  const lessons = await prisma.lesson.findMany({
    where: { centerId },
    include: {
      goals: {
        where: { active: true },
        select: {
          id: true,
          lessonId: true,
          goalIndex: true,
          title: true,
          passingCriteria: true,
        },
      },
      category: { select: { id: true, name: true } },
      remediationsFrom: { select: { id: true, toLessonId: true } },
    },
  });

  // 2. Build existing-link lookup
  const existingLinks = new Set();
  for (const lesson of lessons) {
    for (const rem of lesson.remediationsFrom || []) {
      existingLinks.add(`${lesson.id}::${rem.toLessonId}`);
    }
  }

  // 3. Bucket goals by subjectCode::age
  const buckets = new Map();
  let goalsWithoutRef = 0;

  for (const lesson of lessons) {
    for (const goal of lesson.goals || []) {
      const pc = goal.passingCriteria;
      if (!pc || typeof pc !== "object") {
        goalsWithoutRef++;
        continue;
      }
      const parsed = parseReference(pc.reference);
      if (!parsed) {
        goalsWithoutRef++;
        continue;
      }
      const key = `${parsed.subjectCode}::${parsed.age}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({
        stepNumber: parsed.stepNumber,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        reference: pc.reference,
        subject: pc.subject || parsed.subjectCode,
        age: pc.age || parsed.age,
      });
    }
  }

  // 4. For each bucket, sort and build proposals
  const proposals = [];
  const skipped = [];
  let selfLinkSkipped = 0;
  const seenPairs = new Set(); // deduplicate across goals in same lesson

  for (const [bucketKey, entries] of buckets) {
    entries.sort((a, b) => a.stepNumber - b.stepNumber);

    for (let i = 1; i < entries.length; i++) {
      const higher = entries[i];
      const lower = entries[i - 1];

      if (higher.lessonId === lower.lessonId) {
        selfLinkSkipped++;
        continue;
      }

      const pairKey = `${higher.lessonId}::${lower.lessonId}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const alreadyExists = existingLinks.has(pairKey);

      if (alreadyExists && skipExisting) {
        skipped.push({
          fromLessonId: higher.lessonId,
          fromLessonTitle: higher.lessonTitle,
          toLessonId: lower.lessonId,
          toLessonTitle: lower.lessonTitle,
          reason: `Auto: Step ${higher.stepNumber} → Step ${lower.stepNumber}`,
          skipReason: "already_exists",
        });
        continue;
      }

      proposals.push({
        fromLessonId: higher.lessonId,
        fromLessonTitle: higher.lessonTitle,
        toLessonId: lower.lessonId,
        toLessonTitle: lower.lessonTitle,
        reason: `Auto: ${higher.subject} step ${higher.stepNumber} → ${lower.stepNumber}`,
        subjectCode: bucketKey.split("::")[0],
        age: bucketKey.split("::")[1],
        alreadyExists,
      });
    }
  }

  return {
    proposals,
    skipped,
    stats: {
      totalLessons: lessons.length,
      totalGoals: lessons.reduce((s, l) => s + (l.goals?.length || 0), 0),
      goalsWithoutRef,
      bucketsFound: buckets.size,
      proposalsGenerated: proposals.length,
      skippedExisting: skipped.length,
      selfLinkSkipped,
    },
  };
}

/**
 * Persist the proposals as LessonRemediation records (upsert inside a tx).
 */
export async function commitRemediationProposals({ prisma, proposals }) {
  const created = [];
  const updated = [];
  const errors = [];

  await prisma.$transaction(async (tx) => {
    for (const p of proposals) {
      try {
        const record = await tx.lessonRemediation.upsert({
          where: {
            fromLessonId_toLessonId: {
              fromLessonId: p.fromLessonId,
              toLessonId: p.toLessonId,
            },
          },
          create: {
            fromLessonId: p.fromLessonId,
            toLessonId: p.toLessonId,
            reason: p.reason,
          },
          update: {
            reason: p.reason,
          },
        });
        if (p.alreadyExists) updated.push(record);
        else created.push(record);
      } catch (err) {
        errors.push({
          fromLessonId: p.fromLessonId,
          toLessonId: p.toLessonId,
          error: err.message,
        });
      }
    }
  });

  return { created: created.length, updated: updated.length, errors };
}
