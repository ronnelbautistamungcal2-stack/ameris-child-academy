// Character Guide per subscriber account (client 2026-11-07, step D). Each
// account has its own categories and behaviors. The Global Character Guide
// (client sheet 10-29 (11), row 66) is edited by Global admins under Lesson
// Bank & SOP Bank; every account with Teacher Training, Ameris Academy
// included, can Import a copy of it into theirs. Global admins can fill it
// from Ameris Academy's guide (the guide accounts copied from before).

import prisma from "@/lib/prisma";
import { accountIdForUser, accountSummaryForUser, isGlobalAdmin } from "@/lib/subscriberAccounts";
import { curriculumSourceCenter } from "@/lib/curriculumSource";
import { actionForMethod, can } from "@/lib/globalPermissions";
import { EMPLOYEE_ROLES, hasAnyRole } from "@/lib/roles";

/** The account whose guide the user works with (null: legacy, no account). */
export function guideAccountId(user) {
  return accountIdForUser(user?.id);
}

/** Prisma filter for one account's guide rows. */
export function guideWhere(accountId) {
  return { subscriberAccountId: accountId || null, isGlobal: false };
}

/** Prisma filter for the Global Character Guide's rows. */
export const GLOBAL_GUIDE_WHERE = { isGlobal: true };

/** The Ameris Academy account: owner of the curriculum center, else C-1001. */
export async function amerisGuideAccountId(db = prisma) {
  const source = await curriculumSourceCenter(db);
  if (source?.subscriberAccountId) return source.subscriberAccountId;
  const account = await db.subscriberAccount.findUnique({ where: { accountNumber: "C-1001" }, select: { id: true } });
  return account?.id || null;
}

/**
 * Which guide a Character Guide API request works on:
 * { global, where, data, canRead, canEdit } or null when refused.
 * ?guide=global is the Global guide, for Global admins with Lesson Bank or
 * SOP Bank rights (Permissions & Users); otherwise the user's account's guide
 * (staff read it, admins edit it).
 */
export async function guideScope(req, session) {
  if (String(req.query?.guide || "") === "global") {
    // Only while signed in as Global admin (like requireGlobalAdmin).
    if (session.user.role !== "GLOBAL_ADMIN" || !isGlobalAdmin(session.user)) return null;
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { disabled: true, globalTeamRole: true, globalPermissions: true } });
    const allowed = (action) => Boolean(me && !me.disabled && (can(me, "LESSON_BANK", action) || can(me, "SOP_BANK", action)));
    if (!allowed("VIEW")) return null;
    return {
      global: true,
      where: GLOBAL_GUIDE_WHERE,
      data: { isGlobal: true, subscriberAccountId: null },
      canRead: true,
      canEdit: allowed(actionForMethod(req.method)),
    };
  }
  const accountId = await guideAccountId(session.user);
  return {
    global: false,
    accountId,
    where: guideWhere(accountId),
    data: { isGlobal: false, subscriberAccountId: accountId || null },
    canRead: hasAnyRole(session.user, EMPLOYEE_ROLES),
    canEdit: session.user.role === "ADMIN",
  };
}

// A copy counts as changed by the center when it was saved this long after it
// was imported (the import itself sets both times together).
const EDIT_SLACK_MS = 1000;

const time = (v) => new Date(v).getTime();

/**
 * The source's behaviors compared with the target guide's rows:
 * { source, copies, missing: [source], changed: [{ source, copy }], editedHere }.
 * A target row is a copy of a source behavior when it was imported from it,
 * when both were copied from the same behavior (accounts that imported from
 * Ameris Academy before the Global guide was filled from it), or when it is
 * the behavior the source was copied from (Ameris Academy's own originals).
 * changed = the source was saved after the copy was made; editedHere = how
 * many of those the target had also changed itself.
 */
async function compareGuides(targetWhere, sourceWhere, db = prisma) {
  const [source, rows] = await Promise.all([
    db.characterBehavior.findMany({ where: sourceWhere, orderBy: { createdAt: "asc" } }),
    db.characterBehavior.findMany({ where: targetWhere }),
  ]);
  const byOrigin = new Map();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) if (r.importedFromId) byOrigin.set(r.importedFromId, r);
  const missing = [];
  const changed = [];
  const copies = new Set();
  for (const s of source) {
    let copy = byOrigin.get(s.id) || (s.importedFromId ? byOrigin.get(s.importedFromId) : null);
    // When copied: the import time, else (an original) its last save.
    let since = copy ? time(copy.importedAt || copy.createdAt) : 0;
    if (!copy && s.importedFromId && byId.has(s.importedFromId)) {
      copy = byId.get(s.importedFromId);
      since = time(copy.updatedAt);
    }
    if (!copy || copies.has(copy.id)) {
      if (!copy) missing.push(s);
      continue;
    }
    copies.add(copy.id);
    if (time(s.updatedAt) > since) changed.push({ source: s, copy, since });
  }
  const editedHere = changed.filter(({ copy, since }) => copy.importedAt && time(copy.updatedAt) > since + EDIT_SLACK_MS).length;
  return { source, copies: copies.size, missing, changed, editedHere };
}

/**
 * What the Import button needs for this user:
 * { canImport, reason?, ameris: { categories, behaviors }, missing, updated,
 *   editedHere, imported }.
 * `ameris` is the Global Character Guide. missing = its behaviors not yet in
 * the account; updated = copied ones it has changed since (client 2026-11-11:
 * Import again brings those in).
 */
export async function importStatus(user) {
  const { account, addOns } = await accountSummaryForUser(user.id);
  const out = { canImport: false, reason: "", ameris: { categories: 0, behaviors: 0 }, missing: 0, updated: 0, editedHere: 0, imported: 0 };
  if (!account) return { ...out, reason: "No Ameris Character Guide is available" };
  const [categories, cmp, amerisId] = await Promise.all([
    prisma.characterCategory.count({ where: GLOBAL_GUIDE_WHERE }),
    compareGuides(guideWhere(account.id), GLOBAL_GUIDE_WHERE),
    amerisGuideAccountId(),
  ]);
  out.ameris = { categories, behaviors: cmp.source.length };
  out.imported = cmp.copies;
  out.missing = cmp.missing.length;
  out.updated = cmp.changed.length;
  out.editedHere = cmp.editedHere;
  if (!out.ameris.behaviors) return { ...out, reason: "No Ameris Character Guide is available" };
  // Ameris Academy always gets it (row 66); other accounts with Teacher Training.
  if (account.id !== amerisId && !(addOns || []).includes("TEACHER_TRAINING")) {
    return { ...out, reason: "The Ameris Character Guide comes with the Teacher Training add-on" };
  }
  const work = out.missing + out.updated;
  return { ...out, canImport: work > 0, reason: work ? "" : "You already have every Ameris behavior and update" };
}

/** For the Global page: how Ameris Academy's guide compares with the Global one. */
export async function globalFillStatus() {
  const amerisId = await amerisGuideAccountId();
  const out = { canFill: false, reason: "", missing: 0, updated: 0, editedHere: 0, behaviors: 0 };
  if (!amerisId) return { ...out, reason: "There is no Ameris Academy account" };
  const cmp = await compareGuides(GLOBAL_GUIDE_WHERE, guideWhere(amerisId));
  out.behaviors = cmp.source.length;
  out.missing = cmp.missing.length;
  out.updated = cmp.changed.length;
  out.editedHere = cmp.editedHere;
  const work = out.missing + out.updated;
  return { ...out, canFill: work > 0, reason: work ? "" : "The Global guide already has every Ameris Academy behavior" };
}

/**
 * Copies one guide into another: categories matched by name (created when
 * missing), behaviors not copied before, and the source's changes to ones
 * copied before (they replace the copy). A copy keeps the source's "last
 * updated" time, so guides copied from it see no change until the source is
 * edited again. Returns { categoriesAdded, behaviorsAdded, behaviorsUpdated }.
 */
async function copyGuide({ sourceWhere, targetWhere, targetData, userId }) {
  const categories = await prisma.characterCategory.findMany({ where: sourceWhere, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return prisma.$transaction(async (tx) => {
    const { missing, changed } = await compareGuides(targetWhere, sourceWhere, tx);
    const mine = await tx.characterCategory.findMany({ where: targetWhere });
    const byName = new Map(mine.map((c) => [c.name.toLowerCase(), c]));
    let sortOrder = mine.reduce((max, c) => Math.max(max, c.sortOrder), -1);
    const categoryMap = new Map();
    let categoriesAdded = 0;
    for (const c of categories) {
      let target = byName.get(c.name.toLowerCase());
      if (!target) {
        sortOrder += 1;
        target = await tx.characterCategory.create({ data: { ...targetData, name: c.name, description: c.description, sortOrder } });
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
      importedFromId: b.id,
      importedAt: now,
      updatedAt: b.updatedAt,
      updatedById: userId,
    });
    for (const b of missing) {
      await tx.characterBehavior.create({ data: { ...targetData, ...fields(b) } });
    }
    for (const { source, copy } of changed) {
      await tx.characterBehavior.update({ where: { id: copy.id }, data: fields(source) });
    }
    return { categoriesAdded, behaviorsAdded: missing.length, behaviorsUpdated: changed.length };
  });
}

/** Import the Global Character Guide into an account (the Import button). */
export function importAmerisGuide(accountId, userId) {
  return copyGuide({
    sourceWhere: GLOBAL_GUIDE_WHERE,
    targetWhere: guideWhere(accountId),
    targetData: { isGlobal: false, subscriberAccountId: accountId },
    userId,
  });
}

/** Fill the Global guide from Ameris Academy's guide (Global page button). */
export async function fillGlobalFromAmeris(userId) {
  const amerisId = await amerisGuideAccountId();
  return copyGuide({
    sourceWhere: guideWhere(amerisId),
    targetWhere: GLOBAL_GUIDE_WHERE,
    targetData: { isGlobal: true, subscriberAccountId: null },
    userId,
  });
}
