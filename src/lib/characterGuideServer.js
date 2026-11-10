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

/**
 * What the Import button needs for this user:
 * { canImport, reason?, ameris: { categories, behaviors }, missing, imported }.
 * missing = Ameris behaviors not yet in the account.
 */
export async function importStatus(user) {
  const { account, addOns } = await accountSummaryForUser(user.id);
  const amerisId = await amerisGuideAccountId();
  const out = { canImport: false, reason: "", ameris: { categories: 0, behaviors: 0 }, missing: 0, imported: 0 };
  if (!account || !amerisId) return { ...out, reason: "No Ameris Character Guide is available" };
  if (account.id === amerisId) return { ...out, reason: "This is the Ameris Character Guide" };
  const [categories, behaviors, imported] = await Promise.all([
    prisma.characterCategory.count({ where: guideWhere(amerisId) }),
    prisma.characterBehavior.findMany({ where: guideWhere(amerisId), select: { id: true } }),
    prisma.characterBehavior.findMany({ where: { ...guideWhere(account.id), importedFromId: { not: null } }, select: { importedFromId: true } }),
  ]);
  const have = new Set(imported.map((b) => b.importedFromId));
  out.ameris = { categories, behaviors: behaviors.length };
  out.imported = imported.length;
  out.missing = behaviors.filter((b) => !have.has(b.id)).length;
  if (!(addOns || []).includes("TEACHER_TRAINING")) return { ...out, reason: "The Ameris Character Guide comes with the Teacher Training add-on" };
  return { ...out, canImport: out.missing > 0, reason: out.missing ? "" : "You already have every Ameris behavior" };
}

/**
 * Copies the Ameris guide into the account: categories matched by name
 * (created when missing), behaviors not imported before. Returns counts.
 */
export async function importAmerisGuide(accountId, userId) {
  const amerisId = await amerisGuideAccountId();
  const [categories, behaviors] = await Promise.all([
    prisma.characterCategory.findMany({ where: guideWhere(amerisId), orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.characterBehavior.findMany({ where: guideWhere(amerisId), orderBy: { createdAt: "asc" } }),
  ]);
  return prisma.$transaction(async (tx) => {
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
    const already = new Set(
      (await tx.characterBehavior.findMany({ where: { ...guideWhere(accountId), importedFromId: { not: null } }, select: { importedFromId: true } })).map(
        (b) => b.importedFromId,
      ),
    );
    let behaviorsAdded = 0;
    for (const b of behaviors) {
      if (already.has(b.id)) continue;
      await tx.characterBehavior.create({
        data: {
          subscriberAccountId: accountId,
          categoryId: categoryMap.get(b.categoryId),
          name: b.name,
          type: b.type,
          level: b.level,
          description: b.description,
          tree: b.tree,
          importedFromId: b.id,
          updatedById: userId,
        },
      });
      behaviorsAdded += 1;
    }
    return { categoriesAdded, behaviorsAdded };
  });
}
