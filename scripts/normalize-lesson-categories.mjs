import { PrismaClient } from "@prisma/client";
import { normalizeLessonCategoriesForCenter } from "../src/lib/lessonCategoryNormalization.mjs";

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

const centerId = getArg("--centerId");
const all = process.argv.includes("--all");

const prisma = new PrismaClient();

try {
  if (!centerId && !all) {
    const centers = await prisma.center.findMany({ select: { id: true, name: true } });
    console.log("Missing --centerId (or pass --all). Available centers:");
    for (const c of centers) console.log(`- ${c.name}: ${c.id}`);
    process.exitCode = 2;
  } else if (all) {
    const centers = await prisma.center.findMany({ select: { id: true, name: true } });
    const results = [];
    for (const c of centers) {
      const summary = await normalizeLessonCategoriesForCenter({ prisma, centerId: c.id });
      results.push({ center: c.name, ...summary });
    }
    console.log("Normalization complete:", results);
  } else {
    const summary = await normalizeLessonCategoriesForCenter({ prisma, centerId });
    console.log("Normalization complete:", summary);
  }
} finally {
  await prisma.$disconnect();
}

