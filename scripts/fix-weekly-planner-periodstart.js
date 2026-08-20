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
 */
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

function addOneUtcDay(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function main() {
  const cutoff = new Date(CUTOFF_ISO);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`Invalid CUTOFF_ISO: ${CUTOFF_ISO}`);
  }

  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no changes will be made)"}`);
  console.log(`Cutoff: rows created before ${cutoff.toISOString()} are in scope`);
  if (CENTER_ID) console.log(`Filtered to center: ${CENTER_ID}`);
  if (CLASS_ROOM_ID) console.log(`Filtered to class: ${CLASS_ROOM_ID}`);
  console.log("");

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

  for (const plan of candidates) {
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
    }
  }

  console.log(`\nDone. ${shifted} ${APPLY ? "shifted" : "would be shifted"}, ${collisions} skipped due to collision.`);
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
