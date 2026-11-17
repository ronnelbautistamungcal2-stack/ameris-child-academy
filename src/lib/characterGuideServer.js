// Character Guide per subscriber account (client 2026-11-07, step D). Each
// account has its own categories and behaviors. The Ameris Character Guide is
// the guide of the Ameris account (the one that owns the curriculum center);
// an account with Teacher Training can Import a copy of it into theirs.

import prisma from "@/lib/prisma";
import { accountIdForUser, accountSummaryForUser } from "@/lib/subscriberAccounts";
import { curriculumSourceCenter } from "@/lib/curriculumSource";

/** The account whose guide the user works with (null: legacy, no account). */
export function guideAccountId(user) {
  return accountIdForUser(user?.id);
}

/** Prisma filter for one account's guide rows. */
export function guideWhere(accountId) {
  return { subscriberAccountId: accountId || null };
}

/** The Ameris account: owner of the curriculum center, else C-1001. */
export async function amerisGuideAccountId(db = prisma) {
  const source = await curriculumSourceCenter(db);
  if (source?.subscriberAccountId) return source.subscriberAccountId;
  const account = await db.subscriberAccount.findUnique({ where: { accountNumber: "C-1001" }, select: { id: true } });
  return account?.id || null;
}

// A copy counts as changed by the center when it was saved this long after it
// was imported (the import itself sets both times together).
const EDIT_SLACK_MS = 1000;

/** When a copy was last brought in from Ameris. */
const importedTime = (copy) => new Date(copy.importedAt || copy.createdAt).getTime();

/**
 * The Ameris behaviors compared with the account's copies:
 * { missing: [ameris], changed: [{ ameris, copy }], editedHere: n }.
 * changed = Ameris saved the behavior after it was last imported; editedHere =
 * how many of those the account had also changed itself.
 */
async function compareWithAmeris(accountId, amerisId, db = prisma) {
  const [ameris, copies] = await Promise.all([
    db.characterBehavior.findMany({ where: guideWhere(amerisId), orderBy: { createdAt: "asc" } }),
    db.characterBehavior.findMany({ where: { ...guideWhere(accountId), importedFromId: { not: null } } }),
  ]);
  const byOrigin = new Map(copies.map((c) => [c.importedFromId, c]));
  const missing = [];
  const changed = [];
  for (const b of ameris) {
    const copy = byOrigin.get(b.id);
    if (!copy) missing.push(b);
    else if (new Date(b.updatedAt).getTime() > importedTime(copy)) changed.push({ ameris: b, copy });
  }
  const editedHere = changed.filter(({ copy }) => new Date(copy.updatedAt).getTime() > importedTime(copy) + EDIT_SLACK_MS).length;
  return { ameris, copies, missing, changed, editedHere };
}

/**
 * What the Import button needs for this user:
 * { canImport, reason?, ameris: { categories, behaviors }, missing, updated,
 *   editedHere, imported }.
 * missing = Ameris behaviors not yet in the account; updated = imported ones
 * Ameris has changed since (client 2026-11-11: Import again brings those in).
 */
export async function importStatus(user) {
  const { account, addOns } = await accountSummaryForUser(user.id);
  const amerisId = await amerisGuideAccountId();
  const out = { canImport: false, reason: "", ameris: { categories: 0, behaviors: 0 }, missing: 0, updated: 0, editedHere: 0, imported: 0 };
  if (!account || !amerisId) return { ...out, reason: "No Ameris Character Guide is available" };
  if (account.id === amerisId) return { ...out, reason: "This is the Ameris Character Guide" };
  const [categories, cmp] = await Promise.all([
    prisma.characterCategory.count({ where: guideWhere(amerisId) }),
    compareWithAmeris(account.id, amerisId),
  ]);
  out.ameris = { categories, behaviors: cmp.ameris.length };
  out.imported = cmp.copies.length;
  out.missing = cmp.missing.length;
  out.updated = cmp.changed.length;
  out.editedHere = cmp.editedHere;
  if (!(addOns || []).includes("TEACHER_TRAINING")) return { ...out, reason: "The Ameris Character Guide comes with the Teacher Training add-on" };
  const work = out.missing + out.updated;
  return { ...out, canImport: work > 0, reason: work ? "" : "You already have every Ameris behavior and update" };
}

/**
 * Copies the Ameris guide into the account: categories matched by name
 * (created when missing), behaviors not imported before, and Ameris's changes
 * to behaviors imported before (they replace the account's copy). Returns
 * { categoriesAdded, behaviorsAdded, behaviorsUpdated }.
 */
export async function importAmerisGuide(accountId, userId) {
  const amerisId = await amerisGuideAccountId();
  const categories = await prisma.characterCategory.findMany({ where: guideWhere(amerisId), orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return prisma.$transaction(async (tx) => {
    const { missing, changed } = await compareWithAmeris(accountId, amerisId, tx);
    const mine = await tx.characterCategory.findMany({ where: guideWhere(accountId) });
    const byName = new Map(mine.map((c) => [c.name.toLowerCase(), c]));
    let sortOrder = mine.reduce((max, c) => Math.max(max, c.sortOrder), -1);
    const categoryMap = new Map();
    let categoriesAdded = 0;
    for (const c of categories) {
      let target = byName.get(c.name.toLowerCase());
      if (!target) {
        sortOrder += 1;
        target = await tx.characterCategory.create({
          data: { subscriberAccountId: accountId, name: c.name, description: c.description, sortOrder },
        });
        byName.set(c.name.toLowerCase(), target);
        categoriesAdded += 1;
      }
      categoryMap.set(c.id, target.id);
    }
    const now = new Date();
    const fields = (b) => ({
      categoryId: categoryMap.get(b.categoryId),
      name: b.name,
      type: b.type,
      level: b.level,
      description: b.description,
      tree: b.tree,
      importedAt: now,
      updatedAt: now,
      updatedById: userId,
    });
    for (const b of missing) {
      await tx.characterBehavior.create({ data: { subscriberAccountId: accountId, importedFromId: b.id, ...fields(b) } });
    }
    for (const { ameris, copy } of changed) {
      await tx.characterBehavior.update({ where: { id: copy.id }, data: fields(ameris) });
    }
    return { categoriesAdded, behaviorsAdded: missing.length, behaviorsUpdated: changed.length };
  });
}
