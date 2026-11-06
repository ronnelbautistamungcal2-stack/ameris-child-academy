import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { normalizeAddOns } from "@/lib/addOns";
import { normalizeRoles } from "@/lib/roles";

/**
 * The subscriber account a user belongs to: their own link, or else the
 * account of any center they are a member of. null for people with neither
 * (legacy data), who keep the old unlimited behavior.
 */
export async function accountIdForUser(userId) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriberAccountId: true,
      centers: { select: { center: { select: { subscriberAccountId: true } } } },
    },
  });
  if (!user) return null;
  if (user.subscriberAccountId) return user.subscriberAccountId;
  const fromCenter = (user.centers || []).find((m) => m.center?.subscriberAccountId);
  return fromCenter?.center.subscriberAccountId || null;
}

export async function accountCenterIds(accountId) {
  if (!accountId) return [];
  const centers = await prisma.center.findMany({
    where: { subscriberAccountId: accountId },
    select: { id: true },
  });
  return centers.map((c) => c.id);
}

/**
 * What the signed-in user's account has turned on. `addOns: null` means no
 * account, so nothing is locked.
 */
export async function accountSummaryForUser(userId) {
  const accountId = await accountIdForUser(userId);
  if (!accountId) return { account: null, addOns: null };
  const account = await prisma.subscriberAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      accountNumber: true,
      name: true,
      status: true,
      addOns: true,
      maxCenters: true,
      maxChildren: true,
    },
  });
  if (!account) return { account: null, addOns: null };
  return { account, addOns: normalizeAddOns(account.addOns) };
}

export function isGlobalAdmin(user) {
  return normalizeRoles(user?.roles, user?.role).includes("GLOBAL_ADMIN");
}

/** Next free "C-####" number, starting at C-1001. */
export async function nextAccountNumber(db = prisma) {
  const rows = await db.subscriberAccount.findMany({ select: { accountNumber: true } });
  const max = rows.reduce((top, row) => {
    const n = Number(String(row.accountNumber).replace(/^C-/, ""));
    return Number.isFinite(n) && n > top ? n : top;
  }, 1000);
  return `C-${max + 1}`;
}

const UPGRADE_HINT = "Upgrade your account on the Ameris Solutions Subscription page.";

/** Throws 409 when the account already has as many centers as it pays for. */
export async function assertCenterLimit(accountId) {
  if (!accountId) return;
  const account = await prisma.subscriberAccount.findUnique({
    where: { id: accountId },
    select: { maxCenters: true, _count: { select: { centers: true } } },
  });
  if (!account) return;
  if (account._count.centers >= account.maxCenters) {
    throw apiError(
      409,
      "CENTER_LIMIT_REACHED",
      `You have reached your limit of ${account.maxCenters} center${account.maxCenters === 1 ? "" : "s"}. ${UPGRADE_HINT}`,
      { limit: account.maxCenters },
    );
  }
}

/** Throws 409 when adding `adding` children would pass the account's limit. */
export async function assertChildLimit(centerId, adding = 1) {
  if (!centerId) return;
  const center = await prisma.center.findUnique({
    where: { id: centerId },
    select: { subscriberAccount: { select: { id: true, maxChildren: true } } },
  });
  const account = center?.subscriberAccount;
  if (!account || account.maxChildren == null) return;
  const current = await prisma.child.count({
    where: { center: { subscriberAccountId: account.id } },
  });
  if (current + adding > account.maxChildren) {
    throw apiError(
      409,
      "CHILD_LIMIT_REACHED",
      `You have reached your limit of ${account.maxChildren} children. ${UPGRADE_HINT}`,
      { limit: account.maxChildren, current },
    );
  }
}
