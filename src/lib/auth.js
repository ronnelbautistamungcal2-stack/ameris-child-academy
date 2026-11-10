import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { hasAnyRole } from "@/lib/roles";

/**
 * Get session on server-side with full user context.
 */
export async function getSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  // Sessions of users disabled after signing in stop working at their next refresh.
  if (!session || session.user?.disabled) return null;
  return session;
}

/**
 * Protected route wrapper; ensures session exists and optionally checks role.
 * Returns { user, center } or throws 401/403.
 */
export async function withAuth(handler, requiredRole = null) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const user = session.user;
    if (requiredRole && !hasAnyRole(user, [requiredRole, "ADMIN"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.user = user;
    return handler(req, res);
  };
}

/**
 * Check if user has access to a specific center.
 */
export async function hasAccessToCenter(userId, centerId) {
  const { default: prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { centers: true },
  });
  if (!user) return false;
  if ((user.centers || []).some((c) => c.centerId === centerId)) return true;
  if (hasAnyRole(user, ["GLOBAL_ADMIN"]) && (await supportCenterIds(prisma, user)).includes(centerId)) return true;
  if (!hasAnyRole(user, ["ADMIN"])) return false;
  // Admins reach every center of their own subscriber account, nothing else.
  const ids = await adminCenterIds(prisma, user);
  return ids === null || ids.includes(centerId);
}

/**
 * Centers a subscriber has let Ameris support into (Customer Support > Grant
 * Access), for Ameris global admins until someone clicks End Access.
 */
async function supportCenterIds(prisma, user) {
  if (!hasAnyRole(user, ["GLOBAL_ADMIN"])) return [];
  const grants = await prisma.supportAccessGrant.findMany({ where: { status: "GRANTED" }, select: { centerId: true } });
  return grants.map((g) => g.centerId);
}

/**
 * The centers an admin may manage: every center of their subscriber account.
 * null means no limit, for an admin with no account (legacy data).
 */
async function adminCenterIds(prisma, user) {
  if (!user.subscriberAccountId) return null;
  const centers = await prisma.center.findMany({
    where: { subscriberAccountId: user.subscriberAccountId },
    select: { id: true },
  });
  return centers.map((c) => c.id);
}

/**
 * The centers a user may reach: their memberships, plus every center of
 * their subscriber account for admins. null means no limit (an admin with no
 * account, legacy data).
 */
export async function accessibleCenterIds(userId) {
  const { default: prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { centers: { select: { centerId: true } } },
  });
  if (!user) return [];
  const memberships = (user.centers || []).map((c) => c.centerId);
  const support = await supportCenterIds(prisma, user);
  if (!hasAnyRole(user, ["ADMIN"])) return [...new Set([...memberships, ...support])];
  const ids = await adminCenterIds(prisma, user);
  if (ids === null) return null;
  return [...new Set([...ids, ...memberships, ...support])];
}

/**
 * Prisma condition for a centerId column: the requested center (the caller has
 * already checked access to it), else every center the user may reach.
 * undefined means no limit (an admin with no account, legacy data).
 */
export async function centerIdFilter(userId, centerId) {
  if (centerId) return centerId;
  const ids = await accessibleCenterIds(userId);
  return ids === null ? undefined : { in: ids };
}

/**
 * Prisma `where` limiting users to the signed-in admin's subscriber account,
 * or {} for an admin with no account (legacy data).
 */
export async function adminUserScope(userId) {
  const { default: prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriberAccountId: true, role: true, roles: true },
  });
  const accountId = user?.subscriberAccountId;
  if (!accountId) return {};
  const support = user ? await supportCenterIds(prisma, user) : [];
  return {
    OR: [
      { subscriberAccountId: accountId },
      { centers: { some: { center: { subscriberAccountId: accountId } } } },
      // People at centers Ameris support has been granted access to.
      ...(support.length ? [{ centers: { some: { centerId: { in: support } } } }] : []),
    ],
  };
}

/** True when the user is inside the signed-in admin's subscriber account. */
export async function adminCanReachUser(adminId, userId) {
  if (!userId) return false;
  if (adminId === userId) return true;
  const { default: prisma } = await import("@/lib/prisma");
  const scope = await adminUserScope(adminId);
  const found = await prisma.user.count({ where: { id: String(userId), ...scope } });
  return found > 0;
}
