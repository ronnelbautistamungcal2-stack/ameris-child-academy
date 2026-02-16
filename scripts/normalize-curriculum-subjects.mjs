import { PrismaClient } from "@prisma/client";
import { normalizeSubjectForRef } from "../src/lib/subjectNormalization.mjs";

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

const centerId = getArg("--centerId");
const all = process.argv.includes("--all");
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient();

function toPcObject(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value;
}

try {
  if (!centerId && !all) {
    const centers = await prisma.center.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    console.log("Missing --centerId (or pass --all). Available centers:");
    for (const c of centers) console.log(`- ${c.name}: ${c.id}`);
    process.exitCode = 2;
  } else {
    const where = all ? {} : { lesson: { centerId } };
    const goals = await prisma.lessonGoal.findMany({
      where,
      select: { id: true, passingCriteria: true },
    });

    let scanned = 0;
    let changed = 0;
    const samples = [];

    for (const goal of goals) {
      scanned += 1;
      const pc = toPcObject(goal.passingCriteria);
      const prevSubject = String(pc.subject ?? "");
      const refId = String(pc.reference ?? "");
      const nextSubject = normalizeSubjectForRef({
        subject: prevSubject,
        refId,
      });

      if (!nextSubject || nextSubject === prevSubject) continue;
      changed += 1;
      if (samples.length < 20) {
        samples.push({
          id: goal.id,
          refId,
          from: prevSubject,
          to: nextSubject,
        });
      }

      if (apply) {
        await prisma.lessonGoal.update({
          where: { id: goal.id },
          data: { passingCriteria: { ...pc, subject: nextSubject } },
        });
      }
    }

    console.log("Curriculum subject normalization summary:");
    console.log(`- scanned: ${scanned}`);
    console.log(`- wouldChange: ${changed}`);
    console.log(`- mode: ${apply ? "apply" : "dry-run"}`);
    if (samples.length) {
      console.log("- sample changes:");
      for (const s of samples) {
        console.log(`  ${s.id} | ${s.refId} | "${s.from}" -> "${s.to}"`);
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
