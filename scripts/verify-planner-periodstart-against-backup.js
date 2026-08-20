#!/usr/bin/env node
/**
 * Ground-truth correction for rows mangled by re-running
 * fix-weekly-planner-periodstart.js more than once (see that script's
 * header - it selects candidates by createdAt < cutoff, which never
 * changes, so repeated runs re-shift already-fixed rows whenever the new
 * target happens to be free).
 *
 * Rather than guessing how many extra times a row got bumped and
 * subtracting days, this compares each candidate's periodStart in a
 * scratch database restored from the pre-fix backup (the untouched,
 * original value) against its current value in production, and - only
 * with --apply - sets production directly to (backup value + 1 day),
 * which is the correct answer regardless of how many times the row was
 * mistakenly re-shifted in between.
 *
 * Setup:
 *   1. Restore the pre-fix backup into a new scratch database (do NOT
 *      restore over production):
 *        createdb -h <host> -U <user> ameris_verify_scratch
 *        pg_restore -h <host> -U <user> -d ameris_verify_scratch \
 *          backups/ameris_pre_planner_fix_20260819_215635.dump
 *   2. Point BACKUP_DATABASE_URL at that scratch database and
 *      DATABASE_URL (as usual) at production.
 *
 * Usage:
 *   BACKUP_DATABASE_URL=postgresql://user:pass@host:port/ameris_verify_scratch \
 *   node scripts/verify-planner-periodstart-against-backup.js               # dry run
 *
 *   ...same env... node scripts/verify-planner-periodstart-against-backup.js --apply
 *
 * Optionally restrict to specific plan IDs (comma-separated) instead of
 * re-deriving the full original candidate set:
 *   --ids=c95945a8-...,f5ff321f-...
 */
const { PrismaClient } = require("@prisma/client");

const CUTOFF_ISO = process.env.PLANNER_FIX_CUTOFF || "2026-08-18T05:22:42.413Z";
const APPLY = process.argv.includes("--apply");

function argValue(flag) {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const CENTER_ID = argValue("center");
const CLASS_ROOM_ID = argValue("class");
const ONLY_IDS = argValue("ids");

const backupUrl = process.env.BACKUP_DATABASE_URL;
if (!backupUrl) {
  console.error("Set BACKUP_DATABASE_URL to the scratch database restored from the pre-fix backup.");
  process.exit(1);
}

const prod = new PrismaClient(); // uses DATABASE_URL as normal
const backup = new PrismaClient({ datasources: { db: { url: backupUrl } } });

function addOneUtcDay(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function sameInstant(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

async function main() {
  const cutoff = new Date(CUTOFF_ISO);
  if (Number.isNaN(cutoff.getTime())) throw new Error(`Invalid PLANNER_FIX_CUTOFF: ${CUTOFF_ISO}`);

  console.log(`Mode: ${APPLY ? "APPLY (writing changes to production)" : "DRY RUN (no changes will be made)"}`);
  console.log(`Cutoff: ${cutoff.toISOString()}`);
  console.log(`Backup DB: ${backupUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@")}\n`);

  const where = {
    period: "DAY",
    classRoomId: CLASS_ROOM_ID || { not: null },
    title: "Lesson Planner",
    createdAt: { lt: cutoff },
    ...(CENTER_ID ? { centerId: CENTER_ID } : {}),
    ...(ONLY_IDS ? { id: { in: ONLY_IDS.split(",").map((s) => s.trim()) } } : {}),
  };

  // The original candidate set, as it looked in the pristine backup.
  const pristineRows = await backup.milestoneChecklistPlan.findMany({
    where,
    select: { id: true, centerId: true, classRoomId: true, title: true, period: true, periodStart: true },
    orderBy: { periodStart: "asc" },
  });

  console.log(`Found ${pristineRows.length} row(s) in the backup matching the original candidate criteria.\n`);

  let alreadyCorrect = 0;
  let corrected = 0;
  let collisions = 0;
  let missingInProd = 0;

  for (const pristine of pristineRows) {
    const current = await prod.milestoneChecklistPlan.findUnique({
      where: { id: pristine.id },
      select: { periodStart: true, centerId: true, classRoomId: true, title: true, period: true },
    });

    if (!current) {
      missingInProd += 1;
      console.log(`MISSING IN PRODUCTION: plan ${pristine.id} exists in backup but not in production - investigate before ignoring.`);
      continue;
    }

    const expected = addOneUtcDay(pristine.periodStart);

    if (sameInstant(current.periodStart, expected)) {
      alreadyCorrect += 1;
      continue;
    }

    const clash = await prod.milestoneChecklistPlan.findFirst({
      where: {
        centerId: current.centerId,
        period: current.period,
        periodStart: expected,
        title: current.title,
        classRoomId: current.classRoomId,
        id: { not: pristine.id },
      },
    });

    if (clash) {
      collisions += 1;
      console.log(
        `SKIP (collision): plan ${pristine.id} - backup ${pristine.periodStart.toISOString()} -> correct ${expected.toISOString()}, ` +
          `but currently ${current.periodStart.toISOString()} and target is occupied by plan ${clash.id}.`,
      );
      continue;
    }

    corrected += 1;
    console.log(
      `${APPLY ? "CORRECT" : "WOULD CORRECT"}: plan ${pristine.id} - currently ${current.periodStart.toISOString()} ` +
        `(backup original ${pristine.periodStart.toISOString()}) -> ${expected.toISOString()}`,
    );

    if (APPLY) {
      await prod.milestoneChecklistPlan.update({
        where: { id: pristine.id },
        data: { periodStart: expected },
      });
    }
  }

  console.log(
    `\nDone. ${alreadyCorrect} already correct, ${corrected} ${APPLY ? "corrected" : "would be corrected"}, ` +
      `${collisions} skipped due to collision, ${missingInProd} missing in production.`,
  );
  if (!APPLY) console.log("This was a dry run - re-run with --apply to write changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prod.$disconnect();
    backup.$disconnect();
  });
