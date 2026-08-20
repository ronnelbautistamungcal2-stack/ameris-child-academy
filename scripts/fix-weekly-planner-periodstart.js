#!/usr/bin/env node
/**
 * One-time data fix for the Weekly Lesson Planner day-shift bug.
 *
 * Before commit 08deb53, the client parsed a day-column key like
 * "2026-08-17" via `new Date(key)`, which JS treats as UTC midnight.
 * On a server/browser timezone behind UTC, running that instant through
 * startOfDay()'s local setHours(0,0,0,0) rolled it back to local midnight
 * of the PREVIOUS calendar day - so every Weekly Planner save landed one
 * calendar day earlier than the admin intended.
 *
 * This shifts periodStart forward by exactly one day for every plan saved
 * before the fix went live, scoped tightly to the Weekly Planner's own
 * rows so nothing from admin/milestone-checklists.js or
 * teacher/milestone-checklists.js (which never set classRoomId) is
 * touched:
 *
 *   period = 'DAY' AND classRoomId IS NOT NULL AND title = 'Lesson Planner'
 *   AND createdAt < CUTOFF
 *
 * CONFIRM CUTOFF_ISO below before running with --apply. It must be the
 * exact UTC instant the fixed build went live - too early and some
 * still-broken rows get skipped; too late and already-correct rows saved
 * right after the deploy get shifted onto the wrong day.
 *
 * Usage:
 *   node scripts/fix-weekly-planner-periodstart.js                 # dry run, default
 *   PLANNER_FIX_CUTOFF=2026-08-18T05:22:00.000Z node scripts/fix-weekly-planner-periodstart.js --apply
 *
 * Test against one classroom first before running center-wide:
 *   node scripts/fix-weekly-planner-periodstart.js --class=<classRoomId>
 *   node scripts/fix-weekly-planner-periodstart.js --center=<centerId> --apply
 *
 * SAFE TO RE-RUN: candidates are matched by createdAt < cutoff, which never
 * changes - so without something else tracking "already handled", a second
 * run would reselect every row (including ones already fixed) and shift
 * them again by another day whenever the new target happens to be free.
 * To prevent that, every row this script actually shifts gets its id
 * recorded in a local ledger file (default ./planner-fix-ledger.json, see
 * --ledger below) and is permanently skipped on any future run using that
 * same ledger. Keep the ledger file alongside repeated runs; a fresh/empty
 * ledger makes the script forget what it already fixed.
 *   node scripts/fix-weekly-planner-periodstart.js --ledger=/path/to/ledger.json
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Aug 17 23:22 Mountain Time (MDT, UTC-6) as reported for this deploy - CONFIRM before --apply.
const CUTOFF_ISO = process.env.PLANNER_FIX_CUTOFF || "2026-08-18T05:22:00.000Z";
const APPLY = process.argv.includes("--apply");

function argValue(flag) {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const CENTER_ID = argValue("center");
const CLASS_ROOM_ID = argValue("class");
const LEDGER_PATH = path.resolve(argValue("ledger") || "./planner-fix-ledger.json");

function addOneUtcDay(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function loadLedger() {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveLedgerEntry(ledger, planId, entry) {
  ledger.set(planId, entry);
  const obj = Object.fromEntries(ledger);
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(obj, null, 2));
}

async function main() {
  const cutoff = new Date(CUTOFF_ISO);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`Invalid CUTOFF_ISO: ${CUTOFF_ISO}`);
  }

  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no changes will be made)"}`);
  console.log(`Cutoff: rows created before ${cutoff.toISOString()} are in scope`);
  console.log(`Ledger: ${LEDGER_PATH}`);
  if (CENTER_ID) console.log(`Filtered to center: ${CENTER_ID}`);
  if (CLASS_ROOM_ID) console.log(`Filtered to class: ${CLASS_ROOM_ID}`);
  console.log("");

  const ledger = loadLedger();
  if (ledger.size > 0) {
    console.log(`Loaded ${ledger.size} previously-shifted plan id(s) from the ledger - these are permanently skipped.\n`);
  }

  const candidates = await prisma.milestoneChecklistPlan.findMany({
    where: {
      period: "DAY",
      classRoomId: CLASS_ROOM_ID || { not: null },
      title: "Lesson Planner",
      createdAt: { lt: cutoff },
      ...(CENTER_ID ? { centerId: CENTER_ID } : {}),
    },
    include: { items: { select: { id: true } } },
    orderBy: { periodStart: "asc" },
  });

  console.log(`Found ${candidates.length} candidate plan(s).\n`);

  let shifted = 0;
  let collisions = 0;
  let alreadyLedgered = 0;

  for (const plan of candidates) {
    if (ledger.has(plan.id)) {
      alreadyLedgered += 1;
      continue;
    }

    const newPeriodStart = addOneUtcDay(plan.periodStart);

    const clash = await prisma.milestoneChecklistPlan.findFirst({
      where: {
        centerId: plan.centerId,
        period: plan.period,
        periodStart: newPeriodStart,
        title: plan.title,
        classRoomId: plan.classRoomId,
        id: { not: plan.id },
      },
    });

    if (clash) {
      collisions += 1;
      console.log(
        `SKIP (collision): plan ${plan.id} (center ${plan.centerId}, class ${plan.classRoomId}) ` +
          `${plan.periodStart.toISOString()} -> ${newPeriodStart.toISOString()} already occupied by plan ${clash.id}. ` +
          `${plan.items.length} item(s) on the old row need manual review.`,
      );
      continue;
    }

    shifted += 1;
    console.log(
      `${APPLY ? "SHIFT" : "WOULD SHIFT"}: plan ${plan.id} (center ${plan.centerId}, class ${plan.classRoomId}) ` +
        `${plan.periodStart.toISOString()} -> ${newPeriodStart.toISOString()} (${plan.items.length} item(s))`,
    );

    if (APPLY) {
      await prisma.milestoneChecklistPlan.update({
        where: { id: plan.id },
        data: { periodStart: newPeriodStart },
      });
      saveLedgerEntry(ledger, plan.id, {
        oldPeriodStart: plan.periodStart.toISOString(),
        newPeriodStart: newPeriodStart.toISOString(),
        shiftedAt: new Date().toISOString(),
      });
    }
  }

  console.log(
    `\nDone. ${shifted} ${APPLY ? "shifted" : "would be shifted"}, ${collisions} skipped due to collision, ` +
      `${alreadyLedgered} already handled by a prior run.`,
  );
  if (!APPLY) {
    console.log("This was a dry run - re-run with --apply to write changes.");
  }
  if (collisions > 0) {
    console.log("Review the skipped rows manually (likely a stale duplicate of a since-corrected entry) before deciding whether to merge or delete them.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
