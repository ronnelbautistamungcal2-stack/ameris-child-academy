// Deletes one center and everything in it (client sheet 10-29 (11), row 50:
// the client asked for "Ameris Demo" and "Ameris Test" to be deleted; the
// Centers page has no Delete button on purpose).
//
//   node scripts/delete-center.mjs --id <centerId> --name "<exact center name>"          (dry run: shows what it holds)
//   node scripts/delete-center.mjs --id <centerId> --name "<exact center name>" --apply  (deletes it)
//
// The name must match the center exactly, so a wrong id deletes nothing. One
// transaction: if anything still points at the center, nothing is deleted.

import { PrismaClient } from "@prisma/client";
import { centerContents, deleteCenterData } from "../src/lib/centerDeletion.mjs";

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1] || null;
}

const id = getArg("--id");
const name = getArg("--name");
const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

try {
  if (!id || !name) {
    console.log('Usage: node scripts/delete-center.mjs --id <centerId> --name "<exact center name>" [--apply]');
    process.exitCode = 2;
  } else {
    const center = await prisma.center.findUnique({
      where: { id },
      select: { id: true, name: true, curriculumSource: true, subscriberAccount: { select: { accountNumber: true, name: true } } },
    });
    if (!center) {
      console.log(`No center with id ${id}. Nothing deleted.`);
      process.exitCode = 1;
    } else if (center.name !== name) {
      console.log(`The center ${id} is named "${center.name}", not "${name}". Nothing deleted.`);
      process.exitCode = 1;
    } else if (center.curriculumSource) {
      console.log(`"${center.name}" is the Ameris curriculum center. It can't be deleted with this script.`);
      process.exitCode = 1;
    } else {
      const account = center.subscriberAccount ? `${center.subscriberAccount.accountNumber} ${center.subscriberAccount.name}` : "no account";
      console.log(`Center "${center.name}" (${center.id}), account ${account}`);
      console.log("Holds:", JSON.stringify(await centerContents(prisma, id)));
      if (!apply) {
        console.log("Dry run. Add --apply to delete it.");
      } else {
        await prisma.$transaction((tx) => deleteCenterData(tx, id), { timeout: 120000 });
        console.log(`Deleted "${center.name}".`);
      }
    }
  }
} catch (e) {
  console.error("Failed; nothing was deleted:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
