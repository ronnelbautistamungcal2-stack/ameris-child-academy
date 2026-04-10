import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { hasAnyRole } from "@/lib/roles";

/**
 * Get session on server-side with full user context.
 */
export async function getSession(req, res) {
  return getServerSession(req, res, authOptions);
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
  if (hasAnyRole(user, ["ADMIN"])) return true;
  return (user.centers || []).some((c) => c.centerId === centerId);
}
