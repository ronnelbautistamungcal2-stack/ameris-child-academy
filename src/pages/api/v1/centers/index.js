import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeSubscription } from "@/lib/subscriptions";
import { buildParentLinkedChildWhere } from "@/lib/child-parent-links";
import { directorError, parseCenterInput } from "@/lib/centerSettings";
import { accessibleCenterIds } from "@/lib/auth";
import { accountIdForUser, assertCenterLimit } from "@/lib/subscriberAccounts";
import { sendApiError } from "@/lib/api-error";

function withResolvedSubscription(center) {
  return {
    ...center,
    subscription: normalizeSubscription(center.subscription),
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    // List centers (filtered by user's access if not admin)
    let centers;
    if (session.user.role === "ADMIN") {
      // Only the centers of the admin's own subscriber account.
      const scope = await accessibleCenterIds(session.user.id);
      centers = await prisma.center.findMany({
        where: scope ? { id: { in: scope } } : {},
        include: {
          users: true,
          classes: true,
          subscription: true,
          director: { select: { id: true, name: true, email: true } },
          _count: { select: { children: true } },
        },
      });
    } else if (session.user.role === "PARENT") {
      const children = await prisma.child.findMany({
        where: buildParentLinkedChildWhere(session.user.id),
        select: { centerId: true },
      });
      const memberships = await prisma.centerUser.findMany({
        where: { userId: session.user.id },
        select: { centerId: true },
      });

      const centerIds = [
        ...new Set([
          ...children.map((c) => c.centerId),
          ...memberships.map((m) => m.centerId),
        ]),
      ];
      centers = centerIds.length
        ? await prisma.center.findMany({
            where: { id: { in: centerIds } },
            include: { users: true, classes: true, subscription: true },
          })
        : [];
    } else {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          centers: {
            include: {
              center: {
                include: { users: true, classes: true, subscription: true },
              },
            },
          },
        },
      });
      centers = (user?.centers || []).map((c) => c.center);
    }
    return res.status(200).json(centers.map(withResolvedSubscription));
  }

  if (req.method === "POST") {
    // Create center (admin only)
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create centers" });
    }

    const parsed = parseCenterInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const badDirector = await directorError(prisma, parsed.data.directorId);
    if (badDirector) return res.status(400).json({ error: badDirector });

    // New centers join the admin's account, up to the number it pays for.
    const accountId = await accountIdForUser(session.user.id);
    try {
      await assertCenterLimit(accountId);
    } catch (err) {
      return sendApiError(res, err);
    }

    const center = await prisma.center.create({
      data: { ...parsed.data, ...(accountId ? { subscriberAccountId: accountId } : {}) },
      include: { users: true },
    });

    return res.status(201).json(center);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
