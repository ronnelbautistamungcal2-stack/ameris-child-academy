import { getSession } from "@/lib/auth";
import { accountIdForUser, isGlobalAdmin } from "@/lib/subscriberAccounts";
import prisma from "@/lib/prisma";
import { userRoles } from "@/lib/roles";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { q, limit: limitStr } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.status(200).json([]);
  }

  const limit = Math.min(parseInt(limitStr) || 10, 25);
  const search = String(q).trim();

  // People outside the searcher's subscriber account never show up.
  const accountId = isGlobalAdmin(session.user) ? null : await accountIdForUser(session.user.id);
  const accountScope = accountId
    ? [{ OR: [{ subscriberAccountId: accountId }, { centers: { some: { center: { subscriberAccountId: accountId } } } }] }]
    : [];
  const users = await prisma.user.findMany({
    where: {
      AND: accountScope,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: true,
      pictureUrl: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return res.status(200).json(
    users.map((user) => ({ ...user, roles: userRoles(user) })),
  );
}
