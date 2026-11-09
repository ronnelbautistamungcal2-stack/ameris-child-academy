import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { accountSummaryForUser } from "@/lib/subscriberAccounts";

/**
 * GET /api/v1/account -> { account, addOns, usage }
 * The signed-in person's subscriber account and the add-ons it has. addOns is
 * null when they have no account, which means nothing is locked. Admins also
 * get usage (centers and children) for the Subscription page.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const { account, addOns } = await accountSummaryForUser(session.user.id);
  let usage = null;
  if (account && session.user.role === "ADMIN") {
    const [centers, children] = await Promise.all([
      prisma.center.count({ where: { subscriberAccountId: account.id } }),
      prisma.child.count({ where: { center: { subscriberAccountId: account.id } } }),
    ]);
    usage = { centers, children };
  }
  return res.status(200).json({ account, addOns, usage });
}
