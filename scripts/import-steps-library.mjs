import { PrismaClient } from "@prisma/client";
import { importStepsLibrary } from "../src/lib/stepsLibraryImporter.mjs";

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

const centerId = getArg("--centerId");
const includeCondensedSheet = process.argv.includes("--includeCondensed");

const prisma = new PrismaClient();

try {
  if (!centerId) {
    const centers = await prisma.center.findMany({ select: { id: true, name: true } });
    console.log("Missing --centerId. Available centers:");
    for (const c of centers) console.log(`- ${c.name}: ${c.id}`);
    process.exitCode = 2;
  } else {
    const summary = await importStepsLibrary({
      prisma,
      centerId,
      includeCondensedSheet,
    });
    console.log("Import complete:", summary);
  }
} finally {
  await prisma.$disconnect();
}
